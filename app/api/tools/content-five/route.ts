import Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"
import { auth } from "@/auth"
import { buildPrompt } from "@/lib/contentFive/prompt"
import { overRateLimit } from "@/lib/contentFive/rateLimit"
import { parseIdeas } from "@/lib/contentFive/parse"

// The browser sends the seven answers, never a prompt. The prompt is built
// server-side from validated fields and the API key never leaves this process.
const answersSchema = z.object({
  icp: z.string().trim().min(1).max(500),
  service: z.string().trim().min(1).max(500),
  pain: z.string().trim().max(1500).default(""),
  outcome: z.string().trim().max(500).default(""),
  level: z.enum(["audience", "nurture", "mine"]),
  format: z.enum(["writing", "video", "audio", "images"]),
  channel: z.enum(["google", "linkedin", "youtube", "instagram", "facebook", "reddit", "email", "podcast"]),
})

const MODEL = "claude-sonnet-5"
const MAX_TOKENS = 2000

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "This tool is not configured yet." }, { status: 503 })
  }

  const body = await req.json().catch(() => null)
  const parsed = answersSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: "Missing required answers." }, { status: 400 })

  const limited = await overRateLimit(session.user.id, "content-five")
  if (limited) return Response.json({ error: limited }, { status: 429 })

  // A key that is not scoped to a workspace needs the workspace named per request.
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID
  const client = new Anthropic(workspace ? { defaultHeaders: { "anthropic-workspace-id": workspace } } : {})
  let text = ""
  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      // Sonnet 5 thinks by default and thinking counts against max_tokens —
      // with it on, the JSON was cut off every run and calls took 25s+.
      thinking: { type: "disabled" },
      messages: [{ role: "user", content: buildPrompt(parsed.data) }],
    })
    if (res.stop_reason === "max_tokens" || res.stop_reason === "refusal") {
      return Response.json({ error: "Bad response shape." }, { status: 502 })
    }
    text = res.content.filter(b => b.type === "text").map(b => b.text).join("")
  } catch (err) {
    console.error("content-five: Claude call failed", err)
    return Response.json({ error: "Could not reach Claude." }, { status: 502 })
  }

  const ideas = parseIdeas(text)
  if (!ideas) return Response.json({ error: "Bad response shape." }, { status: 502 })
  return Response.json({ ideas })
}
