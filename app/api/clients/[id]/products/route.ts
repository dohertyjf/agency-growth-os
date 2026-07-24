import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

function coachOnly(session: import("next-auth").Session | null) {
  return session?.user.role === "coach"
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
  if (!coachOnly(session)) return Response.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  const products = await prisma.product.findMany({ where: { clientId: id }, orderBy: { createdAt: "asc" } })
  return Response.json(products)
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!coachOnly(session)) return Response.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: "Invalid" }, { status: 422 })
  const product = await prisma.product.create({ data: { ...parsed.data, clientId: id } })
  return Response.json(product, { status: 201 })
}
