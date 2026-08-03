import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

function authorize(session: import("next-auth").Session | null, clientId: string) {
  if (!session) return false
  if (session.user.role === "coach") return true
  return session.user.clientId === clientId
}

const EMPTY_GOAL = { annualRevenue: 0, profit: 0, monthlyRevenue: 0, netProfitPct: 0, closeRatePct: 0, currency: "USD" }

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
  peoplePct: z.number().min(0).max(100).default(30),
  currency: z.enum(["USD", "GBP", "EUR"]).default("USD"),
  minHourlyRate: z.number().min(0).nullable().optional(),
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

  const { monthlyRevenue, netProfitPct, closeRatePct, peoplePct, currency, minHourlyRate } = parsed.data
  const data = {
    monthlyRevenue,
    netProfitPct,
    closeRatePct,
    peoplePct,
    currency,
    annualRevenue: monthlyRevenue * 12,
    profit: monthlyRevenue * (netProfitPct / 100) * 12,
    ...(minHourlyRate !== undefined ? { minHourlyRate } : {}),
  }

  const goal = await prisma.goal.upsert({
    where: { clientId: id },
    update: data,
    create: { clientId: id, ...data },
  })
  return Response.json(goal)
}

// Partial update for standalone goal fields (e.g. the yield table's minimum $/hr),
// so callers don't need to resend the whole goal.
const patchSchema = z.object({
  minHourlyRate: z.number().min(0).nullable().optional(),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const { id } = await params
  if (!authorize(session, id)) return Response.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: "Invalid" }, { status: 422 })

  const goal = await prisma.goal.upsert({
    where: { clientId: id },
    update: parsed.data,
    create: { clientId: id, ...parsed.data },
  })
  return Response.json(goal)
}
