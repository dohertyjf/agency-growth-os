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
  { params }: { params: Promise<{ id: string; productId: string }> }
) {
  const session = await auth()
  if (!coachOnly(session)) return Response.json({ error: "Forbidden" }, { status: 403 })
  const { id, productId } = await params
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: "Invalid" }, { status: 422 })
  const product = await prisma.product.updateMany({
    where: { id: productId, clientId: id },
    data: parsed.data,
  })
  if (product.count === 0) return Response.json({ error: "Not found" }, { status: 404 })
  const updated = await prisma.product.findUnique({ where: { id: productId } })
  return Response.json(updated)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; productId: string }> }
) {
  const session = await auth()
  if (!coachOnly(session)) return Response.json({ error: "Forbidden" }, { status: 403 })
  const { id, productId } = await params
  await prisma.product.deleteMany({ where: { id: productId, clientId: id } })
  return new Response(null, { status: 204 })
}
