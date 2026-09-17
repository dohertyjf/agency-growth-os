import type { Idea } from "./options"

// The model returns JSON in a text block, sometimes wrapped in a code fence.
// Anything short of five well-formed ideas is null so the caller can 502 and
// the UI offers a retry instead of rendering a partial list.
export function parseIdeas(text: string): Idea[] | null {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
  let data: unknown
  try {
    data = JSON.parse(trimmed)
  } catch {
    return null
  }
  const raw = (data as { ideas?: unknown })?.ideas
  if (!Array.isArray(raw) || raw.length < 5) return null

  const ideas: Idea[] = []
  for (const item of raw.slice(0, 5)) {
    const i = item as Record<string, unknown>
    const beats = Array.isArray(i.beats) ? i.beats.filter(b => typeof b === "string").map(b => (b as string).trim()) : []
    if (
      typeof i.topic !== "string" || typeof i.title !== "string" ||
      typeof i.hook !== "string" || beats.length < 3
    ) return null
    ideas.push({
      topic: i.topic.trim(),
      title: i.title.trim(),
      hook: i.hook.trim(),
      beats: [beats[0], beats[1], beats[2]],
      cta: typeof i.cta === "string" ? i.cta.trim() : "",
    })
  }
  return ideas
}
