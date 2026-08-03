import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const schema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  hours: z.number().min(0),
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

  const { month, hours } = parsed.data

  // hours = 0 clears the entry
  if (hours === 0) {
    await prisma.contractHoursMonth.deleteMany({ where: { contractId, month } })
    return Response.json({ ok: true, cleared: true })
  }

  const row = await prisma.contractHoursMonth.upsert({
    where: { contractId_month: { contractId, month } },
    update: { hours },
    create: { contractId, month, hours },
  })
  return Response.json(row)
}
