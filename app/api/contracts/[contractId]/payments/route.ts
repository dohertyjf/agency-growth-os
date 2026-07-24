import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const schema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  amount: z.number().min(0),
  note: z.string().optional(),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const session = await auth()
  if (!session || session.user.role !== "coach") return Response.json({ error: "Forbidden" }, { status: 403 })

  const { contractId } = await params
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: "Invalid" }, { status: 422 })

  const { month, amount, note } = parsed.data

  const payment = await prisma.contractPayment.upsert({
    where: { contractId_month: { contractId, month } },
    update: { amount, note: note ?? null },
    create: { contractId, month, amount, note: note ?? null },
  })

  return Response.json(payment)
}
