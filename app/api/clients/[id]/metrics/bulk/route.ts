import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

function authorize(session: import("next-auth").Session | null, clientId: string) {
  if (!session) return false
  if (session.user.role === "coach") return true
  return session.user.clientId === clientId
}

const rowSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  revenue: z.number().default(0),
  totalExpenses: z.number().default(0),
  salaries: z.number().default(0),
  software: z.number().default(0),
  cashInBank: z.number().default(0),
  leads: z.number().default(0),
  newClients: z.number().default(0),
  churn: z.number().default(0),
})

const schema = z.array(rowSchema).min(1).max(500)

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const { id } = await params
  if (!authorize(session, id)) return Response.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: "Invalid", details: parsed.error.flatten() }, { status: 422 })

  const rows = await Promise.all(
    parsed.data.map(row =>
      prisma.monthlyMetric.upsert({
        where: { clientId_month: { clientId: id, month: row.month } },
        update: {
          revenue: row.revenue,
          totalExpenses: row.totalExpenses,
          salaries: row.salaries,
          software: row.software,
          cashInBank: row.cashInBank,
          leads: row.leads,
          newClients: row.newClients,
          churn: row.churn,
        },
        create: { clientId: id, ...row, closeRate: 0 },
      })
    )
  )

  return Response.json(rows, { status: 201 })
}
