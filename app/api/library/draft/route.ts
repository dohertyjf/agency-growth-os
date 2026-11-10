import { auth } from "@/auth"
import { z } from "zod"
import { completeText, ClaudeError } from "@/lib/claude"
import { CATEGORIES, CATEGORY_KEYS } from "@/lib/library"

const schema = z.object({
  title: z.string().optional(),
  transcript: z.string().optional(),
  synopsis: z.string().optional(),
})

const SYSTEM = `You turn a recorded coaching call for agency owners into a library training.
John Doherty coaches agency owners across three categories: ${CATEGORIES.map(c => `${c.label} (${c.blurb})`).join("; ")}.
The call may have been a group cohort call. Write for any agency owner watching the recording later: drop names of attendees, cohort logistics, and small talk.

Return ONLY a JSON object, no prose, with these keys:
- "title": a specific, plain title naming what the training teaches (max 70 characters). Not "Group Call Week 3".
- "category": whichever of ${CATEGORIES.map(c => `"${c.key}"`).join(", ")} the call mostly teaches.
- "summary": 2-3 sentences on what the viewer will learn and why it matters.
- "takeaways": 3-5 strings, each one concrete idea from the call.
- "actionSteps": 3-6 strings, each an action the viewer can do this week, starting with a verb.
- "tags": 2-4 short lowercase topic tags (e.g. "growth", "sales", "pricing").
Use only what is in the call. Do not invent numbers or examples.`

const MAX_CHARS = 300_000

export async function POST(req: Request) {
  const session = await auth()
  if (session?.user.role !== "coach") return Response.json({ error: "Forbidden" }, { status: 403 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: "Invalid" }, { status: 422 })
  const { title, transcript, synopsis } = parsed.data
  if (!transcript?.trim() && !synopsis?.trim()) {
    return Response.json({ error: "Add a transcript or recap first — Claude drafts from that." }, { status: 422 })
  }

  const source = [
    title && `Call title: ${title}`,
    synopsis?.trim() && `Recap:\n${synopsis.trim()}`,
    transcript?.trim() && `Transcript:\n${transcript.trim().slice(0, MAX_CHARS)}`,
  ].filter(Boolean).join("\n\n")

  try {
    const res = await completeText({
      system: SYSTEM,
      messages: [{ role: "user", content: source }],
      maxTokens: 8000,
      effort: "low",
      signal: req.signal,
    })
    const json = res.text.slice(res.text.indexOf("{"), res.text.lastIndexOf("}") + 1)
    const draft = z.object({
      title: z.string().default(""),
      category: z.enum(CATEGORY_KEYS).optional().catch(undefined),
      summary: z.string().default(""),
      takeaways: z.array(z.string()).default([]),
      actionSteps: z.array(z.string()).default([]),
      tags: z.array(z.string()).default([]),
    }).parse(JSON.parse(json))
    return Response.json(draft)
  } catch (err) {
    if (err instanceof ClaudeError && err.code === "not_configured") {
      return Response.json({ error: "Claude isn't configured (ANTHROPIC_API_KEY)." }, { status: 503 })
    }
    console.error("library draft failed", err)
    return Response.json({ error: "Claude couldn't draft this one — try again, or fill it in by hand." }, { status: 502 })
  }
}
