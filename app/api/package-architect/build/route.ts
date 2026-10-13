import type { NextRequest } from "next/server"
import { intakeSchema, combinedLength } from "@/lib/packageArchitect/schema"
import { buildBasePrompt } from "@/lib/packageArchitect/prompt"
import { PA_CONFIG } from "@/lib/packageArchitect/config"
import { PAError, contextFor, preflight, generate, errorResponse, streamResult } from "@/lib/packageArchitect/run"

// Public, unauthenticated. Guarded by honeypot, input ceiling, per-IP rate
// limit and a hard output-token cap. Nothing the visitor pastes is persisted.
// Netlify caps synchronous functions at 60s and does not let you raise it,
// so this is a ceiling for other hosts, not a promise here. Effort is tuned to
// land a build in ~20-40s with room for the one repair retry.
export const maxDuration = 120

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== "object") return errorResponse(new PAError("bad_request", 400))
  if (typeof body.honeypot === "string" && body.honeypot.length > 0) {
    // Quietly accept and do nothing expensive.
    return errorResponse(new PAError("bad_request", 400))
  }

  // Length first so a 200 KB paste is rejected before schema work, with the
  // message the visitor needs rather than a generic validation failure.
  const rawLen = ["source", "who", "outcome", "price", "worth", "ceiling"]
    .reduce((n, k) => n + (typeof body[k] === "string" ? body[k].length : 0), 0)
  if (rawLen > PA_CONFIG.maxInputChars) return errorResponse(new PAError("too_long", 413))

  const parsed = intakeSchema.safeParse(body)
  if (!parsed.success) {
    const short = parsed.error.issues.some(i => i.path[0] === "source" && i.code === "too_small")
    return errorResponse(new PAError(short ? "too_short" : "bad_request", 400))
  }
  const intake = parsed.data
  if (combinedLength(intake) > PA_CONFIG.maxInputChars) return errorResponse(new PAError("too_long", 413))

  const ctx = contextFor(req, "build", combinedLength(intake))
  try {
    preflight(ctx)
  } catch (err) {
    return errorResponse(err as PAError)
  }

  const prompt = buildBasePrompt(intake)
  return streamResult(() => generate(ctx, [{ role: "user", content: prompt }], req.signal))
}
