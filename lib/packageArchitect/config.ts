// Package Architect knobs. Every number here can be overridden by an env var
// of the same name in Netlify, so limits change without a deploy.

function envInt(name: string, fallback: number): number {
  const v = process.env[name]
  if (!v) return fallback
  const n = parseInt(v, 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export const PA_CONFIG = {
  // Rate limit, per hashed IP. Build and refine share the same bucket.
  buildsPerHour: envInt("PA_BUILDS_PER_HOUR", 5),
  buildsPerDay: envInt("PA_BUILDS_PER_DAY", 20),

  // Combined length of the six intake fields (plus the note, on refine).
  maxInputChars: envInt("PA_MAX_INPUT_CHARS", 12000),

  // Hard ceiling on what one call can generate. Thinking tokens count against
  // this too, and measured runs use 3k-5.5k total, so 8k truncated the JSON
  // on heavier thinking passes. A ceiling is not a spend: we are billed for
  // what is generated, so the headroom is free and only caps a runaway.
  maxOutputTokens: envInt("PA_MAX_OUTPUT_TOKENS", 24000),

  // Reasoning depth. Measured on a real proposal: low ~41s, medium ~68s,
  // both producing the same prices and structure. Netlify cuts a function off
  // at 60s, so low is the only level that leaves room for the repair retry.
  effort: ((): "low" | "medium" | "high" | "xhigh" | "max" => {
    const v = process.env.PA_EFFORT
    return v === "low" || v === "medium" || v === "high" || v === "xhigh" || v === "max" ? v : "low"
  })(),

  minSourceChars: 60,
  ctaUrl: "https://johnfdoherty.com/strategy-call/",
} as const

export const HOUR_MS = 60 * 60 * 1000
export const DAY_MS = 24 * HOUR_MS
