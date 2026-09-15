import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const schema = z.object({
  title: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  transcript: z.string().optional(),
  video: z.string().optional(),
  synopsis: z.string().optional(),
  notes: z.string().optional(),
  isGroupCall: z.boolean().optional(),
  programId: z.string().nullable().optional(),
})

// Call recaps/notes/transcripts are coaching artifacts — clients may view them
// (via read routes) but only the coach may edit them.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ callId: string }> }
) {
  const session = await auth()
  if (!session || session.user.role !== "coach") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }
  const { callId } = await params
  const call = await prisma.call.findUnique({ where: { id: callId } })
  if (!call) return Response.json({ error: "Not found" }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: "Invalid" }, { status: 422 })

  const updated = await prisma.call.update({
    where: { id: callId },
    data: parsed.data,
    include: { questions: { orderBy: { order: "asc" } } },
  })
  return Response.json(updated)
}
