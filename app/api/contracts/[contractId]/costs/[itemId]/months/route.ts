import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { authorizeContract } from "@/lib/contractAuth"

const schema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  amount: z.number().min(0),
})

// The amount of a cost line item in a month. amount = 0 clears the cell.
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ contractId: string; itemId: string }> }
) {
  const { contractId, itemId } = await params
  const contract = await authorizeContract(contractId)
  if (!contract) return Response.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: "Invalid" }, { status: 422 })
  const { month, amount } = parsed.data

  const item = await prisma.projectCostItem.findFirst({ where: { id: itemId, contractId } })
  if (!item) return Response.json({ error: "Not found" }, { status: 404 })

  if (amount === 0) {
    await prisma.projectCostMonth.deleteMany({ where: { costItemId: itemId, month } })
    return Response.json({ costItemId: itemId, month, amount: 0 })
  }
  const row = await prisma.projectCostMonth.upsert({
    where: { costItemId_month: { costItemId: itemId, month } },
    update: { amount },
    create: { costItemId: itemId, month, amount },
  })
  return Response.json(row)
}
