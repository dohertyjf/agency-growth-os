import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

function authorize(session: import("next-auth").Session | null, clientId: string) {
  if (!session) return false
  if (session.user.role === "coach") return true
  return session.user.clientId === clientId
}

const EMPTY_GOAL = { annualRevenue: 0, profit: 0, monthlyRevenue: 0, netProfitPct: 0, closeRatePct: 0 }

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const { id } = await params
  if (!authorize(session, id)) return Response.json({ error: "Forbidden" }, { status: 403 })

  const goal = await prisma.goal.findUnique({ where: { clientId: id } })
  return Response.json(goal ?? EMPTY_GOAL)
}

const schema = z.object({
  monthlyRevenue: z.number().min(0),
  netProfitPct: z.number().min(0).max(100),
  closeRatePct: z.number().min(0).max(100),
})

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const { id } = await params
  if (!authorize(session, id)) return Response.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: "Invalid" }, { status: 422 })

  const { monthlyRevenue, netProfitPct, closeRatePct } = parsed.data
  const data = {
    monthlyRevenue,
    netProfitPct,
    closeRatePct,
    annualRevenue: monthlyRevenue * 12,
    profit: monthlyRevenue * (netProfitPct / 100) * 12,
  }

  const goal = await prisma.goal.upsert({
    where: { clientId: id },
    update: data,
    create: { clientId: id, ...data },
  })
  return Response.json(goal)
}
