import "server-only"
import type Anthropic from "@anthropic-ai/sdk"
import { completeText, ClaudeError } from "@/lib/claude"
import { checkRateLimit, clientIp, hashIp } from "@/lib/rateLimit"
import { PA_CONFIG, HOUR_MS, DAY_MS } from "./config"
import { extractJson, validateResult } from "./schema"
import { repairInstruction } from "./prompt"
import type { PAErrorCode, PAResult, PAStreamLine } from "./types"

export class PAError extends Error {
  code: PAErrorCode
  status: number
  retryAfterSeconds?: number
  constructor(code: PAErrorCode, status: number, retryAfterSeconds?: number) {
    super(code)
    this.code = code
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
  }
}

// ── Per-request context ──────────────────────────────────────────────────────

export interface PAContext {
  route: "build" | "refine"
  ipHash: string
  inputLen: number
}

export function contextFor(req: Request, route: PAContext["route"], inputLen: number): PAContext {
  return { route, ipHash: hashIp(clientIp(req)), inputLen }
}

// Config check first so a misdeployed server fails loudly without spending
// anyone's allowance; then the shared bucket so refinements count as builds.
export function preflight(ctx: PAContext): void {
  if (!process.env.ANTHROPIC_API_KEY) {
    log({ ...ctx, event: "not_configured" })
    throw new PAError("unavailable", 503)
  }
  const r = checkRateLimit("package-architect", ctx.ipHash, [
    { limit: PA_CONFIG.buildsPerHour, windowMs: HOUR_MS },
    { limit: PA_CONFIG.buildsPerDay, windowMs: DAY_MS },
  ])
  if (!r.ok) {
    log({ ...ctx, event: "rate_limited", retryAfterSeconds: r.retryAfterSeconds })
    throw new PAError("rate_limited", 429, r.retryAfterSeconds)
  }
}

// One structured line per Claude call. Never includes prompt or reply text.
function log(fields: Record<string, unknown>) {
  console.log(JSON.stringify({ tag: "package-architect", ts: new Date().toISOString(), ...fields }))
}

// ── Generate + validate + one repair retry ───────────────────────────────────

export async function generate(
  ctx: PAContext,
  messages: Anthropic.MessageParam[],
  signal?: AbortSignal,
): Promise<PAResult> {
  let convo = messages
  let lastProblem = ""

  for (let attempt = 1; attempt <= 2; attempt++) {
    let text: string
    try {
      const res = await completeText({
        messages: convo,
        maxTokens: PA_CONFIG.maxOutputTokens,
        effort: PA_CONFIG.effort,
        signal,
      })
      text = res.text
      log({
        ...ctx, event: "call", attempt, ok: true,
        inputTokens: res.usage.inputTokens, outputTokens: res.usage.outputTokens,
        cacheRead: res.usage.cacheReadTokens, ms: res.latencyMs, stop: res.stopReason,
      })
    } catch (err) {
      const code = err instanceof ClaudeError ? err.code : "unknown"
      // An abandoned run is logged as its own event so the cost log is not
      // polluted with failures that are really just closed tabs.
      log({ ...ctx, event: code === "aborted" ? "abandoned" : "call", attempt, ok: false, code })
      throw toPAError(err)
    }

    let parsed: unknown
    try {
      parsed = extractJson(text)
    } catch {
      lastProblem = "it was not valid JSON"
      convo = repairTurn(convo, text, lastProblem)
      log({ ...ctx, event: "invalid", attempt, problem: lastProblem })
      continue
    }

    const v = validateResult(parsed)
    if (v.ok) return v.result

    lastProblem = v.problem
    log({ ...ctx, event: "invalid", attempt, problem: lastProblem })
    convo = repairTurn(convo, text, lastProblem)
  }

  throw new PAError("malformed", 502)
}

function repairTurn(convo: Anthropic.MessageParam[], badReply: string, problem: string): Anthropic.MessageParam[] {
  return [
    ...convo,
    { role: "assistant", content: badReply.trim() || "(empty reply)" },
    { role: "user", content: repairInstruction(problem) },
  ]
}

function toPAError(err: unknown): PAError {
  if (err instanceof PAError) return err
  if (err instanceof ClaudeError) {
    switch (err.code) {
      case "not_configured": return new PAError("unavailable", 503)
      case "upstream_rate_limited":
      case "upstream_overloaded": return new PAError("unavailable", 503)
      case "truncated":
      case "refused": return new PAError("malformed", 502)
      case "aborted": return new PAError("error", 499)
      default: return new PAError("error", 502)
    }
  }
  return new PAError("error", 500)
}

// ── HTTP helpers ─────────────────────────────────────────────────────────────

export function errorResponse(err: PAError): Response {
  const headers: Record<string, string> = { "Cache-Control": "no-store" }
  if (err.retryAfterSeconds) headers["Retry-After"] = String(err.retryAfterSeconds)
  return Response.json(
    { error: err.code, ...(err.retryAfterSeconds ? { retryAfterSeconds: err.retryAfterSeconds } : {}) },
    { status: err.status, headers },
  )
}

// Stream NDJSON so the connection stays alive for the whole generation. The
// HTTP status is 200 once bytes start flowing; every pre-flight failure
// (bad body, too long, rate limit) returns a real status before we get here.
export function streamResult(work: () => Promise<PAResult>): Response {
  const enc = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (line: PAStreamLine) => controller.enqueue(enc.encode(JSON.stringify(line) + "\n"))
      send({ type: "status", text: "Reading what you sell" })
      const beat = setInterval(() => {
        try { send({ type: "status", text: "Reading what you sell" }) } catch { /* closed */ }
      }, 4000)
      try {
        const data = await work()
        send({ type: "result", data })
      } catch (err) {
        const pe = err instanceof PAError ? err : toPAError(err)
        send({ type: "error", error: pe.code })
      } finally {
        clearInterval(beat)
        controller.close()
      }
    },
  })
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  })
}
