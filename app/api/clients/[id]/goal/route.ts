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

  const goal = await prisma.goal.findUnique({ where: { clientId: id } })
  return Response.json(goal ?? { annualRevenue: 0, profit: 0 })
}

const schema = z.object({
  annualRevenue: z.number().min(0),
  profit: z.number().min(0),
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

  const goal = await prisma.goal.upsert({
    where: { clientId: id },
    update: parsed.data,
    create: { clientId: id, ...parsed.data },
  })
  return Response.json(goal)
}
