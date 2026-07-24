import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

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
  start: z.string().regex(/^\d{4}-\d{2}$/),
  contractedThrough: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  status: z.enum(["potential", "active", "finished"]).default("potential"),
  type: z.enum(["retainer", "oneoff"]).default("retainer"),
  accountId: z.string().nullable().optional(),
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
  // One-offs: contractedThrough must equal start
  const contractedThrough = data.type === "oneoff" ? data.start : (data.contractedThrough ?? data.start)

  const contract = await prisma.contract.create({
    data: { clientId: id, ...data, contractedThrough },
  })
  return Response.json(contract, { status: 201 })
}
