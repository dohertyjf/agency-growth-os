import "server-only"
import Anthropic from "@anthropic-ai/sdk"

// The single Claude client for August. Every feature that talks to Claude
// goes through here so key handling, model choice, timeouts and error mapping
// live in exactly one place. Never import this from a client component.

export const CLAUDE_MODEL = "claude-opus-5"

let _client: Anthropic | null = null
function client(): Anthropic {
  if (_client) return _client
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ClaudeError("not_configured", "ANTHROPIC_API_KEY is not set")
  }
  // Long generations stream over ~60s; the SDK's default 10 min timeout is
  // fine, but retries would double a slow call, so we keep them to one.
  _client = new Anthropic({ maxRetries: 1 })
  return _client
}

// Internal error taxonomy. Routes map these to HTTP statuses and user copy;
// nothing about the underlying SDK error reaches the browser.
export type ClaudeErrorCode =
  | "not_configured"
  | "upstream_rate_limited"
  | "upstream_overloaded"
  | "upstream_bad_request"
  | "upstream_error"
  | "refused"
  | "truncated"
  | "network"
  | "aborted"

export class ClaudeError extends Error {
  code: ClaudeErrorCode
  constructor(code: ClaudeErrorCode, message?: string) {
    super(message ?? code)
    this.code = code
    this.name = "ClaudeError"
  }
}

export interface ClaudeUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

export interface ClaudeTextResult {
  text: string
  usage: ClaudeUsage
  latencyMs: number
  stopReason: string | null
}

export interface ClaudeTextOptions {
  messages: Anthropic.MessageParam[]
  system?: string
  maxTokens: number
  effort?: "low" | "medium" | "high" | "xhigh" | "max"
  signal?: AbortSignal
}

// Run one non-agentic text completion and return the concatenated text.
// Uses the SDK's streaming transport (finalMessage) so long outputs never
// trip an HTTP idle timeout, without exposing partial tokens to callers.
export async function completeText(opts: ClaudeTextOptions): Promise<ClaudeTextResult> {
  const started = Date.now()
  try {
    const stream = client().messages.stream(
      {
        model: CLAUDE_MODEL,
        max_tokens: opts.maxTokens,
        ...(opts.system ? { system: opts.system } : {}),
        ...(opts.effort ? { output_config: { effort: opts.effort } } : {}),
        messages: opts.messages,
      },
      { signal: opts.signal },
    )
    const message = await stream.finalMessage()

    if (message.stop_reason === "refusal") throw new ClaudeError("refused")

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map(b => b.text)
      .join("")

    const usage: ClaudeUsage = {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
    }

    if (message.stop_reason === "max_tokens") {
      throw new ClaudeError("truncated", `hit max_tokens=${opts.maxTokens}`)
    }

    return { text, usage, latencyMs: Date.now() - started, stopReason: message.stop_reason }
  } catch (err) {
    if (err instanceof ClaudeError) throw err
    throw mapSdkError(err)
  }
}

function mapSdkError(err: unknown): ClaudeError {
  // Most specific first. Everything falls through to a generic upstream error.
  // A visitor closing the tab is not a failure: keep it out of the error stats.
  if (err instanceof Anthropic.APIUserAbortError) return new ClaudeError("aborted", "client disconnected")
  if (err instanceof Error && err.name === "AbortError") return new ClaudeError("aborted", "client disconnected")
  if (err instanceof Anthropic.RateLimitError) return new ClaudeError("upstream_rate_limited", err.message)
  if (err instanceof Anthropic.AuthenticationError) return new ClaudeError("not_configured", "invalid API key")
  if (err instanceof Anthropic.BadRequestError) return new ClaudeError("upstream_bad_request", err.message)
  if (err instanceof Anthropic.InternalServerError) return new ClaudeError("upstream_overloaded", err.message)
  if (err instanceof Anthropic.APIConnectionError) return new ClaudeError("network", err.message)
  if (err instanceof Anthropic.APIError) {
    if (err.status === 529) return new ClaudeError("upstream_overloaded", err.message)
    return new ClaudeError("upstream_error", `${err.status ?? "?"} ${err.message}`)
  }
  return new ClaudeError("upstream_error", err instanceof Error ? err.message : String(err))
}
