import { auth } from "@/auth"
import { z } from "zod"
import { overRateLimit } from "@/lib/contentFive/rateLimit"
import { inputsSchema, fixSchema, runOptions, streamJson } from "@/lib/offerBuilder/run"

// Step 2: rebuild the offer as three options using the chosen fixes + feedback.
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const parsed = z.object({
    inputs: inputsSchema,
    fixes: z.array(fixSchema).max(10).default([]),
    feedback: z.string().max(4000).default(""),
  }).safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 422 })

  const limited = await overRateLimit(session.user.id, "offer-builder")
  if (limited) return Response.json({ error: limited }, { status: 429 })
  const { inputs, fixes, feedback } = parsed.data
  return streamJson(async () => ({ options: await runOptions(inputs, fixes, feedback, req.signal) }))
}
