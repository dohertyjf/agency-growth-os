import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

function coachOnly(session: import("next-auth").Session | null) {
  return session?.user.role === "coach"
}

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(["retainer", "oneoff"]).default("retainer"),
  monthly: z.number().min(0),
})

export async function GET(req: Request) {
  const session = await auth()
  if (!coachOnly(session)) return Response.json({ error: "Forbidden" }, { status: 403 })
  const products = await prisma.product.findMany({ orderBy: { createdAt: "asc" } })
  return Response.json(products)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!coachOnly(session)) return Response.json({ error: "Forbidden" }, { status: 403 })
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: "Invalid" }, { status: 422 })
  const product = await prisma.product.create({ data: parsed.data })
  return Response.json(product, { status: 201 })
}
