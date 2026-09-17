import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { budgetedHours } from "@/lib/calc"

function authorize(session: import("next-auth").Session | null, clientId: string) {
  if (!session) return false
  if (session.user.role === "coach") return true
  return session.user.clientId === clientId
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const { id } = await params
  if (!authorize(session, id)) return Response.json({ error: "Forbidden" }, { status: 403 })

  const contracts = await prisma.contract.findMany({
    where: { clientId: id },
    orderBy: { monthly: "desc" },
  })
  return Response.json(contracts)
}

const schema = z.object({
  name: z.string().min(1),
  monthly: z.number().min(0),
  hoursPerMonth: z.number().min(0).default(0),
  start: z.string().regex(/^\d{4}-\d{2}$/),
  contractedThrough: z.string().regex(/^\d{4}-\d{2}$/).nullable().optional(),
  status: z.enum(["opportunity", "potential", "active", "lost", "finished"]).default("potential"),
  type: z.enum(["retainer", "oneoff"]).default("retainer"),
  accountId: z.string().nullable().optional(),
  productId: z.string().nullable().optional(),
  deliveryStart: z.string().regex(/^\d{4}-\d{2}$/).nullable().optional(),
  deliveryEnd: z.string().regex(/^\d{4}-\d{2}$/).nullable().optional(),
  ownerId: z.string().nullable().optional(),
  callDate: z.string().nullable().optional(),
  signedDate: z.string().nullable().optional(),
  kickoffDate: z.string().nullable().optional(),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const { id } = await params
  if (!authorize(session, id)) return Response.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: "Invalid" }, { status: 422 })

  const data = parsed.data
  // One-offs: contractedThrough = start; ongoing retainers: null
  const contractedThrough = data.type === "oneoff" ? data.start : (data.contractedThrough ?? null)
  // A finished retainer must have an end month, or it counts as contracted MRR forever.
  if (data.status === "finished" && data.type !== "oneoff" && !contractedThrough) {
    return Response.json({ error: "A finished retainer needs an end month" }, { status: 422 })
  }

  // Hours left blank → budget them from the fee at the client's Minimum Hourly Yield.
  // Most add forms don't ask for hours, so this is what makes a new project show up
  // on the yield and capacity views straight away.
  let hoursPerMonth = data.hoursPerMonth
  if (!(hoursPerMonth > 0)) {
    const goal = await prisma.goal.findUnique({ where: { clientId: id }, select: { minHourlyRate: true } })
    hoursPerMonth = budgetedHours(data.monthly, goal?.minHourlyRate)
  }

  const contract = await prisma.contract.create({
    data: { clientId: id, ...data, hoursPerMonth, contractedThrough },
  })
  return Response.json(contract, { status: 201 })
}
