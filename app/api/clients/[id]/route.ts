import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const schema = z.object({
  status: z.enum(["potential", "active", "paused"]).optional(),
  endDate: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  name: z.string().min(1).optional(),
  agency: z.string().nullable().optional(),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session || session.user.role !== "coach") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 422 })

  const client = await prisma.client.update({
    where: { id },
    data: parsed.data,
  })

  return Response.json(client)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session || session.user.role !== "coach") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  // Delete in dependency order to avoid FK violations
  const calls = await prisma.call.findMany({ where: { clientId: id }, select: { id: true } })
  if (calls.length) {
    await prisma.question.deleteMany({ where: { callId: { in: calls.map(c => c.id) } } })
  }
  await prisma.call.deleteMany({ where: { clientId: id } })
  await prisma.contract.deleteMany({ where: { clientId: id } })
  await prisma.monthlyMetric.deleteMany({ where: { clientId: id } })
  await prisma.goal.deleteMany({ where: { clientId: id } })
  await prisma.user.updateMany({ where: { clientId: id }, data: { clientId: null } })
  await prisma.client.delete({ where: { id } })

  return new Response(null, { status: 204 })
}
