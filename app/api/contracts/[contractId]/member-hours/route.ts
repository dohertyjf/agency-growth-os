import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { authorizeContract } from "@/lib/contractAuth"

const schema = z.object({
  personId: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  hours: z.number().min(0),
})

// Hours one person spent on this project in a month. hours = 0 clears the row.
// The project total (ContractHoursMonth) is rewritten as the sum of the
// per-person rows so the Yield / capacity views stay in step.
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const { contractId } = await params
  const contract = await authorizeContract(contractId)
  if (!contract) return Response.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: "Invalid" }, { status: 422 })
  const { personId, month, hours } = parsed.data

  const person = await prisma.person.findFirst({ where: { id: personId, clientId: contract.clientId } })
  if (!person) return Response.json({ error: "Person not found" }, { status: 404 })

  if (hours === 0) {
    await prisma.projectMemberHoursMonth.deleteMany({ where: { contractId, personId, month } })
  } else {
    await prisma.projectMemberHoursMonth.upsert({
      where: { contractId_personId_month: { contractId, personId, month } },
      update: { hours },
      create: { contractId, personId, month, hours },
    })
  }

  const agg = await prisma.projectMemberHoursMonth.aggregate({ where: { contractId, month }, _sum: { hours: true } })
  const total = agg._sum.hours ?? 0
  if (total > 0) {
    await prisma.contractHoursMonth.upsert({
      where: { contractId_month: { contractId, month } },
      update: { hours: total },
      create: { contractId, month, hours: total },
    })
  } else {
    await prisma.contractHoursMonth.deleteMany({ where: { contractId, month } })
  }

  return Response.json({ contractId, personId, month, hours, total })
}
