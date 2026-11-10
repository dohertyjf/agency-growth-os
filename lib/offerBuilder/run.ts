import "server-only"
import { z } from "zod"
import { completeText, ClaudeError } from "@/lib/claude"
import { OFFER_FIELDS, OFFER_FIELD_KEYS, type GapCheck, type OfferInputs, type OfferOption, type OfferFix } from "./fields"
import { GAP_CHECK_SYSTEM, OPTIONS_SYSTEM } from "./prompt"

const MAX_FIELD = 4000
const str = (max = MAX_FIELD) => z.string().max(max).default("")

// What the browser may send. Never a prompt — only the offer's own fields.
export const inputsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  idealClient: z.string().trim().min(1).max(MAX_FIELD),
  ...Object.fromEntries(OFFER_FIELD_KEYS.map(k => [k, str()])),
}) as unknown as z.ZodType<OfferInputs>

export const fixSchema = z.object({
  id: z.string().max(20),
  field: z.enum(OFFER_FIELD_KEYS),
  title: z.string().max(200),
  detail: z.string().max(1000),
})

const gapCheckSchema = z.object({
  strengths: z.array(z.string()).default([]),
  gaps: z.array(z.object({
    field: z.enum(OFFER_FIELD_KEYS).catch("deliverables"),
    severity: z.enum(["missing", "weak"]).catch("weak"),
    issue: z.string(),
  })).default([]),
  fixes: z.array(fixSchema).default([]),
})

const versionSchema = z.object({
  headline: z.string().default(""),
  ...Object.fromEntries(OFFER_FIELD_KEYS.map(k => [k, z.string().default("")])),
})
const optionsSchema = z.object({
  options: z.array(z.object({ label: z.string(), angle: z.string(), offer: versionSchema })).min(1),
})

function describe(inputs: OfferInputs): string {
  const lines = [
    `Offer name: ${inputs.name}`,
    `Ideal Client: ${inputs.idealClient}`,
    ...OFFER_FIELDS.map(f => `${f.label} [${f.key}]: ${inputs[f.key]?.trim() || "(left blank)"}`),
  ]
  return lines.join("\n")
}

function parseJson<T>(text: string, schema: z.ZodType<T>): T {
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)
  try {
    return schema.parse(JSON.parse(json))
  } catch {
    throw new ClaudeError("upstream_error", "malformed JSON from Claude")
  }
}

// Low effort keeps each call well under Netlify's 60s function limit.
export async function runGapCheck(inputs: OfferInputs, signal?: AbortSignal): Promise<GapCheck> {
  const res = await completeText({
    system: GAP_CHECK_SYSTEM,
    messages: [{ role: "user", content: `Here is the current offer:\n\n${describe(inputs)}` }],
    maxTokens: 12000, effort: "low", signal,
  })
  return parseJson(res.text, gapCheckSchema) as GapCheck
}

export async function runOptions(inputs: OfferInputs, fixes: OfferFix[], feedback: string, signal?: AbortSignal): Promise<OfferOption[]> {
  const chosen = fixes.length
    ? fixes.map(f => `- ${f.title} (${f.field}): ${f.detail}`).join("\n")
    : "(none chosen — improve the offer using your own judgment)"
  const content = `Here is the current offer:\n\n${describe(inputs)}\n\nFixes the owner chose to integrate:\n${chosen}\n\nOwner's feedback:\n${feedback.trim() || "(none)"}`
  const res = await completeText({
    system: OPTIONS_SYSTEM,
    messages: [{ role: "user", content }],
    maxTokens: 20000, effort: "low", signal,
  })
  return (parseJson(res.text, optionsSchema) as { options: OfferOption[] }).options.slice(0, 3)
}

// Plain-English message for a failed Claude call.
function claudeErrorMessage(err: unknown): string {
  if (err instanceof ClaudeError) {
    if (err.code === "not_configured") return "The Offer Builder isn't configured yet."
    if (err.code === "upstream_rate_limited" || err.code === "upstream_overloaded") return "Claude is busy right now — try again in a minute."
  }
  console.error("offer builder failed", err)
  return "Something went wrong building this — try again."
}

// Stream NDJSON (same pattern as Package Architect) so the connection stays
// alive past Netlify's 60s function limit: a heartbeat line every 4s, then one
// {type:"result"} or {type:"error"} line. Pre-flight failures (bad body, rate
// limit) return a real HTTP status before this is called.
export function streamJson(work: () => Promise<unknown>): Response {
  const enc = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (line: object) => controller.enqueue(enc.encode(JSON.stringify(line) + "\n"))
      send({ type: "beat" })
      const beat = setInterval(() => { try { send({ type: "beat" }) } catch { /* closed */ } }, 4000)
      try {
        send({ type: "result", data: await work() })
      } catch (err) {
        if (!(err instanceof ClaudeError && err.code === "aborted")) send({ type: "error", error: claudeErrorMessage(err) })
      } finally {
        clearInterval(beat)
        try { controller.close() } catch { /* closed */ }
      }
    },
  })
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" },
  })
}
