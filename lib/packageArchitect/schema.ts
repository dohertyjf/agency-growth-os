import { z } from "zod"
import type { PAResult } from "./types"
import { PA_CONFIG } from "./config"

// ── Intake (request bodies) ──────────────────────────────────────────────────

const text = (max: number) => z.string().trim().max(max).optional().default("")

export const intakeSchema = z.object({
  source: z.string().trim().min(PA_CONFIG.minSourceChars).max(PA_CONFIG.maxInputChars),
  who: text(2000),
  outcome: text(2000),
  price: text(500),
  worth: text(500),
  ceiling: text(1000),
  // Bots fill every field. Humans never see this one.
  honeypot: z.string().max(0).optional(),
})

export const refineBodySchema = z.object({
  intake: intakeSchema,
  previous: z.unknown(),
  note: z.string().trim().min(3).max(2000),
  honeypot: z.string().max(0).optional(),
})

export function combinedLength(intake: z.infer<typeof intakeSchema>, note = ""): number {
  return (
    intake.source.length + intake.who.length + intake.outcome.length +
    intake.price.length + intake.worth.length + intake.ceiling.length + note.length
  )
}

// ── Result (what Claude must return) ─────────────────────────────────────────

const nonEmpty = z.string().trim().min(1)
const list = (min: number, max: number) => z.array(nonEmpty).min(min).max(max)

const packageSchema = z.object({
  rank: z.enum(["Entry", "Core", "Premium"]),
  share: nonEmpty,
  name: nonEmpty,
  tagline: nonEmpty,
  forWho: nonEmpty,
  includes: list(1, 10),
  excludes: list(1, 6),
  price: nonEmpty,
  term: nonEmpty,
  logic: nonEmpty,
})

export const resultSchema = z.object({
  read: nonEmpty,
  core: nonEmpty,
  flag: z.string().trim(), // may legitimately be ""
  packages: z.tuple([packageSchema, packageSchema, packageSchema]),
  present: nonEmpty,
  pushback: nonEmpty,
  downsell: z.object({ name: nonEmpty, price: nonEmpty, what: nonEmpty, pitch: nonEmpty }),
  addons: z.array(z.object({ name: nonEmpty, price: nonEmpty, why: nonEmpty })).min(1).max(8),
  priceMath: nonEmpty,
  terms: nonEmpty,
})

// "$4,500" → 4500, "$12.5k" → 12500, "4500 per month" → 4500. First number wins.
export function parsePrice(s: string): number | null {
  const m = s.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*(k|K)?/)
  if (!m) return null
  const n = parseFloat(m[1]) * (m[2] ? 1000 : 1)
  return Number.isFinite(n) ? n : null
}

// Pull the JSON object out of a reply that may be wrapped in prose or fences.
export function extractJson(text: string): unknown {
  const stripped = text.replace(/```(?:json)?/gi, "").trim()
  const start = stripped.indexOf("{")
  const end = stripped.lastIndexOf("}")
  if (start === -1 || end === -1 || end <= start) throw new Error("no JSON object found")
  return JSON.parse(stripped.slice(start, end + 1))
}

// Parse + shape-check + business-rule-check. Returns the typed result or a
// short description of what was wrong, for the repair turn.
export function validateResult(raw: unknown): { ok: true; result: PAResult } | { ok: false; problem: string } {
  const parsed = resultSchema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { ok: false, problem: `${first.path.join(".") || "root"}: ${first.message}` }
  }
  const r = parsed.data

  const ranks = r.packages.map(p => p.rank)
  if (ranks[0] !== "Entry" || ranks[1] !== "Core" || ranks[2] !== "Premium") {
    return { ok: false, problem: `packages must be ranked Entry, Core, Premium in that order (got ${ranks.join(", ")})` }
  }

  const prices = r.packages.map(p => parsePrice(p.price))
  if (prices.some(p => p === null)) {
    return { ok: false, problem: "every package price must contain a number" }
  }
  const [a, b, c] = prices as number[]
  if (!(a < b && b < c)) {
    return { ok: false, problem: `package prices must ascend (got ${a}, ${b}, ${c})` }
  }

  return { ok: true, result: r as PAResult }
}
