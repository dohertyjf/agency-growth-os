import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { netProfit, grossProfit, netMargin } from "@/lib/calc"

const INPUT_FIELDS = [
  "revenue", "totalExpenses", "salaries", "software",
  "cashInBank", "leads", "newClients", "closeRate", "churn",
]

function authorize(session: import("next-auth").Session | null, clientId: string) {
  if (!session) return false
  if (session.user.role === "coach") return true
  return session.user.clientId === clientId
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; month: string }> }
) {
  const session = await auth()
  const { id, month } = await params
  if (!authorize(session, id)) return Response.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== "object" || Array.isArray(body))
    return Response.json({ error: "Invalid body" }, { status: 422 })

  const updates: Record<string, number> = {}
  for (const [key, val] of Object.entries(body)) {
    if (!INPUT_FIELDS.includes(key) || typeof val !== "number")
      return Response.json({ error: `Invalid field: ${key}` }, { status: 422 })
    updates[key] = val
  }
  if (!Object.keys(updates).length)
    return Response.json({ error: "No valid fields" }, { status: 422 })

  const m = await prisma.monthlyMetric.upsert({
    where: { clientId_month: { clientId: id, month } },
    update: updates,
    create: { clientId: id, month, ...updates },
  })

  return Response.json({
    ...m,
    grossProfit: grossProfit(m.revenue, m.salaries),
    netProfit: netProfit(m.revenue, m.totalExpenses),
    netMargin: netMargin(m.revenue, m.totalExpenses),
  })
}
