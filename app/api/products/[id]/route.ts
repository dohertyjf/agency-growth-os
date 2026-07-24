import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

function coachOnly(session: import("next-auth").Session | null) {
  return session?.user.role === "coach"
}

const schema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  type: z.enum(["retainer", "oneoff"]).optional(),
  monthly: z.number().min(0).optional(),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!coachOnly(session)) return Response.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: "Invalid" }, { status: 422 })
  const product = await prisma.product.update({ where: { id }, data: parsed.data })
  return Response.json(product)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!coachOnly(session)) return Response.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  await prisma.product.delete({ where: { id } })
  return new Response(null, { status: 204 })
}
