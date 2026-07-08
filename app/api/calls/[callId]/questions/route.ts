import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const schema = z.object({ q: z.string().min(1) })

export async function POST(
  req: Request,
  { params }: { params: Promise<{ callId: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: "Forbidden" }, { status: 403 })

  const { callId } = await params
  const call = await prisma.call.findUnique({
    where: { id: callId },
    include: { questions: true },
  })
  if (!call) return Response.json({ error: "Not found" }, { status: 404 })

  if (session.user.role !== "coach" && session.user.clientId !== call.clientId) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: "Invalid" }, { status: 422 })

  const question = await prisma.question.create({
    data: { callId, q: parsed.data.q, order: call.questions.length },
  })
  return Response.json(question, { status: 201 })
}
