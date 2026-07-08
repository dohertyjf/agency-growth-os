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
})

async function authorizeCall(session: Awaited<ReturnType<typeof auth>>, callId: string) {
  if (!session) return null
  const call = await prisma.call.findUnique({ where: { id: callId } })
  if (!call) return null
  if (session.user.role === "coach") return call
  if (session.user.clientId === call.clientId) return call
  return null
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ callId: string }> }
) {
  const session = await auth()
  const { callId } = await params
  const call = await authorizeCall(session, callId)
  if (!call) return Response.json({ error: "Forbidden or not found" }, { status: 403 })

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
