import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

async function authorize(session: import("next-auth").Session | null, contractId: string) {
  if (!session) return null
  const contract = await prisma.contract.findUnique({ where: { id: contractId } })
  if (!contract) return null
  if (session.user.role === "coach") return contract
  if (session.user.clientId === contract.clientId) return contract
  return null
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const session = await auth()
  const { contractId } = await params
  if (!(await authorize(session, contractId))) return Response.json({ error: "Forbidden" }, { status: 403 })
  const months = await prisma.contractDeliveryMonth.findMany({ where: { contractId }, orderBy: { month: "asc" } })
  return Response.json(months.map(m => ({ month: m.month, hours: m.hours })))
}

const schema = z.object({
  months: z.array(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/), hours: z.number().min(0) })),
})

// Replace the full set of planned-hours rows for this project.
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const session = await auth()
  const { contractId } = await params
  if (!(await authorize(session, contractId))) return Response.json({ error: "Forbidden" }, { status: 403 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: "Invalid" }, { status: 422 })

  const rows = parsed.data.months.filter(m => m.hours > 0)
  await prisma.$transaction([
    prisma.contractDeliveryMonth.deleteMany({ where: { contractId } }),
    ...rows.map(m => prisma.contractDeliveryMonth.create({ data: { contractId, month: m.month, hours: m.hours } })),
  ])
  return Response.json(rows)
}
