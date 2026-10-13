import type { NextRequest } from "next/server"
import { refineBodySchema, combinedLength, resultSchema } from "@/lib/packageArchitect/schema"
import { buildBasePrompt, refineInstruction } from "@/lib/packageArchitect/prompt"
import { PA_CONFIG } from "@/lib/packageArchitect/config"
import { PAError, contextFor, preflight, generate, errorResponse, streamResult } from "@/lib/packageArchitect/run"

// Stateless refine: the client sends back the original intake and the previous
// result, we replay the base prompt + previous answer + the correction as a
// three-turn conversation. Same rate-limit bucket as /build.
// Netlify caps synchronous functions at 60s and does not let you raise it,
// so this is a ceiling for other hosts, not a promise here. Effort is tuned to
// land a build in ~20-40s with room for the one repair retry.
export const maxDuration = 120

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== "object") return errorResponse(new PAError("bad_request", 400))
  if (typeof body.honeypot === "string" && body.honeypot.length > 0) {
    return errorResponse(new PAError("bad_request", 400))
  }

  const intakeRaw = body.intake && typeof body.intake === "object" ? body.intake : {}
  const rawLen = ["source", "who", "outcome", "price", "worth", "ceiling"]
    .reduce((n, k) => n + (typeof intakeRaw[k] === "string" ? intakeRaw[k].length : 0), 0)
    + (typeof body.note === "string" ? body.note.length : 0)
  if (rawLen > PA_CONFIG.maxInputChars) return errorResponse(new PAError("too_long", 413))

  const parsed = refineBodySchema.safeParse(body)
  if (!parsed.success) return errorResponse(new PAError("bad_request", 400))
  const { intake, note } = parsed.data

  // The previous result is echoed into the conversation as an assistant turn,
  // so it must be a well-formed result and not arbitrary text.
  const prev = resultSchema.safeParse(parsed.data.previous)
  if (!prev.success) return errorResponse(new PAError("bad_request", 400))

  const inputLen = combinedLength(intake, note)
  if (inputLen > PA_CONFIG.maxInputChars) return errorResponse(new PAError("too_long", 413))

  const ctx = contextFor(req, "refine", inputLen)
  try {
    preflight(ctx)
  } catch (err) {
    return errorResponse(err as PAError)
  }

  const messages = [
    { role: "user" as const, content: buildBasePrompt(intake) },
    { role: "assistant" as const, content: JSON.stringify(prev.data) },
    { role: "user" as const, content: refineInstruction(note) },
  ]
  return streamResult(() => generate(ctx, messages, req.signal))
}
