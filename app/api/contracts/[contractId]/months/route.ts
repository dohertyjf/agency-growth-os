import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const schema = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/), actual: z.number().min(0) })

async function authorizeContract(session: import("next-auth").Session | null, contractId: string) {
  if (!session) return null
  const contract = await prisma.contract.findUnique({ where: { id: contractId } })
  if (!contract) return null
  if (session.user.role === "coach") return contract
  if (session.user.clientId === contract.clientId) return contract
  return null
}

async function recalculateRevenue(clientId: string, month: string) {
  const contracts = await prisma.contract.findMany({
    where: { clientId },
    include: { accountMonths: { where: { month } } },
  })

  let revenue = 0
  for (const c of contracts) {
    if (c.status !== "active") continue
    if (c.start > month || (c.contractedThrough !== null && c.contractedThrough < month)) continue
    const am = c.accountMonths[0]
    revenue += am ? am.actual : c.monthly
  }

  await prisma.monthlyMetric.upsert({
    where: { clientId_month: { clientId, month } },
    update: { revenue },
    create: { clientId, month, revenue, totalExpenses: 0, salaries: 0, software: 0, cashInBank: 0, leads: 0, newClients: 0, closeRate: 0, churn: 0 },
  })

  return revenue
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const session = await auth()
  const { contractId } = await params
  const contract = await authorizeContract(session, contractId)
  if (!contract) return Response.json({ error: "Forbidden or not found" }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: "Invalid" }, { status: 422 })

  const { month, actual } = parsed.data

  const accountMonth = await prisma.accountMonth.upsert({
    where: { contractId_month: { contractId, month } },
    update: { actual },
    create: { contractId, month, actual },
  })

  const revenue = await recalculateRevenue(contract.clientId, month)

  return Response.json({ accountMonth, revenue })
}
