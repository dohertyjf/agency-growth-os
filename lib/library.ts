// Studio Sessions (the "Library" in code): every training sits in one of three fixed categories
// and can carry any number of tags.

export const CATEGORIES = [
  { key: "pipeline", label: "Pipeline", blurb: "ICP, marketing and sales" },
  { key: "offer", label: "Offer", blurb: "Pricing, packaging and profit" },
  { key: "delivery", label: "Delivery", blurb: "Ops, hiring and getting out of delivery" },
] as const

export type CategoryKey = (typeof CATEGORIES)[number]["key"]
export const CATEGORY_KEYS = CATEGORIES.map(c => c.key) as [CategoryKey, ...CategoryKey[]]

export function categoryLabel(key: string): string {
  return CATEGORIES.find(c => c.key === key)?.label ?? key
}

// A session's URL slug: "The ICP Focuser" → "icp-focuser". A leading "The"
// is dropped so URLs stay short.
export function sessionSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/^the\s+/, "")
    .replace(/[\s-]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
    .replace(/-$/, "")
}

// Link to a session by its slug, or its id when it has none yet.
export function sessionHref(t: { id: string; slug?: string | null }): string {
  return `/sessions/${t.slug || t.id}`
}

// Takeaways and action steps are stored one per line.
export function lines(text: string | null | undefined): string[] {
  return (text ?? "").split("\n").map(l => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim()).filter(Boolean)
}

// Tags are case-insensitive: "Growth" and "growth" are the same tag.
export function normalizeTags(names: string[]): string[] {
  return [...new Set(names.map(n => n.trim().toLowerCase().replace(/^#/, "")).filter(Boolean))]
}
