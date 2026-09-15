import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { authorizeContract } from "@/lib/contractAuth"

const schema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  category: z.enum(["content", "ads", "software", "vendor", "other"]).optional(),
  reimbursed: z.boolean().optional(),
})

type Params = { params: Promise<{ contractId: string; itemId: string }> }

export async function PATCH(req: Request, { params }: Params) {
  const { contractId, itemId } = await params
  const contract = await authorizeContract(contractId)
  if (!contract) return Response.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: "Invalid" }, { status: 422 })

  const existing = await prisma.projectCostItem.findFirst({ where: { id: itemId, contractId } })
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 })

  const item = await prisma.projectCostItem.update({ where: { id: itemId }, data: parsed.data })
  return Response.json(item)
}

export async function DELETE(_req: Request, { params }: Params) {
  const { contractId, itemId } = await params
  const contract = await authorizeContract(contractId)
  if (!contract) return Response.json({ error: "Forbidden" }, { status: 403 })

  await prisma.projectCostItem.deleteMany({ where: { id: itemId, contractId } })
  return Response.json({ ok: true })
}
