import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const schema = z.object({ personId: z.string().min(1), role: z.string().optional() })

export async function POST(
  req: Request,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const session = await auth()
  if (!session || session.user.role !== "coach") return Response.json({ error: "Forbidden" }, { status: 403 })
  const { contractId } = await params
  const contract = await prisma.contract.findUnique({ where: { id: contractId } })
  if (!contract) return Response.json({ error: "Not found" }, { status: 404 })
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: "Invalid" }, { status: 422 })
  const { personId, role } = parsed.data
  const member = await prisma.projectMember.upsert({
    where: { contractId_personId: { contractId, personId } },
    update: { role: role ?? null },
    create: { contractId, personId, role: role ?? null },
  })
  return Response.json(member)
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const session = await auth()
  if (!session || session.user.role !== "coach") return Response.json({ error: "Forbidden" }, { status: 403 })
  const { contractId } = await params
  const personId = new URL(req.url).searchParams.get("personId")
  if (!personId) return Response.json({ error: "personId required" }, { status: 400 })
  await prisma.projectMember.deleteMany({ where: { contractId, personId } })
  return Response.json({ ok: true })
}
