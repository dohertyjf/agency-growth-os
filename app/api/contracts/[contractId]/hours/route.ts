import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { authorizeContract } from "@/lib/contractAuth"

const schema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  hours: z.number().min(0),
})

// Hours are actuals: they can be logged for the current month or earlier, never ahead.
// Clearing (hours = 0) is always allowed so stray future entries can be removed.
const isFuture = (month: string) => month > new Date().toISOString().slice(0, 7)

export async function POST(
  req: Request,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const { contractId } = await params
  // Same rule as per-person hours: a coach, or the client user who owns the project.
  if (!(await authorizeContract(contractId))) return Response.json({ error: "Forbidden" }, { status: 403 })
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: "Invalid" }, { status: 422 })

  const { month, hours } = parsed.data
  if (hours > 0 && isFuture(month)) return Response.json({ error: "Hours can't be logged for a future month" }, { status: 422 })

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
