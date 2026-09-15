import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { computeInsights } from "@/lib/insights"
import { z } from "zod"

function authorize(session: import("next-auth").Session | null, clientId: string) {
  if (!session) return false
  if (session.user.role === "coach") return true
  return session.user.clientId === clientId
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const { id } = await params
  if (!authorize(session, id)) return Response.json({ error: "Forbidden" }, { status: 403 })

  const url = new URL(req.url)
  const range = parseInt(url.searchParams.get("range") ?? "6", 10)

  const client = await prisma.client.findUnique({ where: { id } })
  if (!client) return Response.json({ error: "Not found" }, { status: 404 })

  const metrics = await prisma.monthlyMetric.findMany({
    where: { clientId: id },
    orderBy: { month: "desc" },
    take: range,
  })
  metrics.reverse()

  return Response.json(computeInsights(metrics))
}

const schema = z.object({ enabled: z.boolean() })

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

  return Response.json({ enabled: parsed.data.enabled })
}
