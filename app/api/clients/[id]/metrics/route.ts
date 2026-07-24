import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { netProfit, grossProfit, netMargin } from "@/lib/calc"

function authorize(session: import("next-auth").Session | null, clientId: string) {
  if (!session) return false
  if (session.user.role === "coach") return true
  return session.user.clientId === clientId
}

function addDerived(m: {
  revenue: number; totalExpenses: number; salaries: number; software: number
  cashInBank: number; leads: number; newClients: number; closeRate: number; churn: number
  month: string; id: string; clientId: string
}) {
  return {
    ...m,
    grossProfit: grossProfit(m.revenue, m.salaries),
    netProfit: netProfit(m.revenue, m.salaries, m.software, m.totalExpenses),
    netMargin: netMargin(m.revenue, m.salaries, m.software, m.totalExpenses),
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const { id } = await params
  if (!authorize(session, id)) return Response.json({ error: "Forbidden" }, { status: 403 })

  const url = new URL(req.url)
  const range = parseInt(url.searchParams.get("range") ?? "12", 10)

  const metrics = await prisma.monthlyMetric.findMany({
    where: { clientId: id },
    orderBy: { month: "desc" },
    take: range,
  })
  metrics.reverse()

  return Response.json(metrics.map(addDerived))
}
