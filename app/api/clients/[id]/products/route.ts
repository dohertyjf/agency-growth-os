import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

// Coach, or the client who owns this profile (it's their own service list).
function authorize(session: import("next-auth").Session | null, clientId: string) {
  if (!session) return false
  if (session.user.role === "coach") return true
  return session.user.clientId === clientId
}

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(["retainer", "ongoing", "oneoff"]).default("retainer"),
  monthly: z.number().min(0),
})

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const { id } = await params
  if (!authorize(session, id)) return Response.json({ error: "Forbidden" }, { status: 403 })
  const products = await prisma.product.findMany({ where: { clientId: id }, orderBy: { createdAt: "asc" } })
  return Response.json(products)
}

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
  const product = await prisma.product.create({ data: { ...parsed.data, clientId: id } })
  return Response.json(product, { status: 201 })
}
