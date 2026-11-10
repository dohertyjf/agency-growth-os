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

// Takeaways and action steps are stored one per line.
export function lines(text: string | null | undefined): string[] {
  return (text ?? "").split("\n").map(l => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim()).filter(Boolean)
}

// Tags are case-insensitive: "Growth" and "growth" are the same tag.
export function normalizeTags(names: string[]): string[] {
  return [...new Set(names.map(n => n.trim().toLowerCase().replace(/^#/, "")).filter(Boolean))]
}
