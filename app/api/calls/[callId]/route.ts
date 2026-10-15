import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const schema = z.object({
  clientId: z.string().min(1).nullable().optional(), // assign a call to a client; null with isSalesCall
  isSalesCall: z.boolean().optional(),
  prospectEmail: z.string().nullable().optional(),
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

  if (parsed.data.clientId) {
    const client = await prisma.client.findUnique({ where: { id: parsed.data.clientId }, select: { id: true } })
    if (!client) return Response.json({ error: "Client not found" }, { status: 422 })
  }

  // A sales call never belongs to a client (so no client-visible query can
  // reach it): assigning a client makes it a client call, and marking it a
  // sales call detaches it from any client or group.
  const data = { ...parsed.data }
  if (data.clientId === null && !data.isSalesCall) delete data.clientId // only a sales call may drop its client
  if (data.clientId || data.isGroupCall) data.isSalesCall = false
  else if (data.isSalesCall) Object.assign(data, { clientId: null, isGroupCall: false, programId: null })

  const updated = await prisma.call.update({
    where: { id: callId },
    data,
    include: { questions: { orderBy: { order: "asc" } } },
  })
  return Response.json(updated)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ callId: string }> }
) {
  const session = await auth()
  if (!session || session.user.role !== "coach") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }
  const { callId } = await params
  const call = await prisma.call.findUnique({ where: { id: callId }, select: { id: true } })
  if (!call) return Response.json({ error: "Not found" }, { status: 404 })

  // Questions first: the DB's FK may not cascade (schema drift), same as client delete.
  await prisma.$transaction([
    prisma.question.deleteMany({ where: { callId } }),
    prisma.call.delete({ where: { id: callId } }),
  ])
  return Response.json({ ok: true })
}
