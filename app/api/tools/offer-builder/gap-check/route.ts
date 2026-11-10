import { auth } from "@/auth"
import { z } from "zod"
import { overRateLimit } from "@/lib/contentFive/rateLimit"
import { inputsSchema, runGapCheck, streamJson } from "@/lib/offerBuilder/run"

// Step 1: review the offer against the four pillars and suggest fixes.
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const parsed = z.object({ inputs: inputsSchema }).safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: "Give the offer a name and describe your Ideal Client first." }, { status: 422 })

  const limited = await overRateLimit(session.user.id, "offer-builder")
  if (limited) return Response.json({ error: limited }, { status: 429 })
  return streamJson(() => runGapCheck(parsed.data.inputs, req.signal))
}
