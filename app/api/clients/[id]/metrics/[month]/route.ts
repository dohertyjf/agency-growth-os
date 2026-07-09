import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { netProfit, grossProfit, netMargin } from "@/lib/calc"

const DERIVED = ["netProfit", "grossProfit", "netMargin"]
const INPUT_FIELDS = [
  "revenue", "totalExpenses", "salaries", "software",
  "cashInBank", "leads", "newClients", "closeRate", "churn",
]

const schema = z.object({
  field: z.string().refine(f => INPUT_FIELDS.includes(f), "Not an editable field"),
  value: z.number(),
})

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
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: "Invalid" }, { status: 422 })

  const { field, value } = parsed.data

  const m = await prisma.monthlyMetric.upsert({
    where: { clientId_month: { clientId: id, month } },
    update: { [field]: value },
    create: { clientId: id, month, [field]: value },
  })

  return Response.json({
    ...m,
    netProfit: netProfit(m.revenue, m.totalExpenses),
    grossProfit: grossProfit(m.revenue, m.salaries, m.software),
    netMargin: netMargin(m.revenue, m.totalExpenses),
  })
}
