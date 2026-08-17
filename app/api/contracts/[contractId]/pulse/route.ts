import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const schema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  score: z.number().int().min(1).max(5),
  note: z.string().optional(),
})

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

  const { month, score, note } = parsed.data
  const pulse = await prisma.contractPulse.upsert({
    where: { contractId_month: { contractId, month } },
    update: { score, note: note ?? null },
    create: { contractId, month, score, note: note ?? null },
  })
  return Response.json(pulse)
}
