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
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  type: z.enum(["retainer", "ongoing", "oneoff"]).optional(),
  monthly: z.number().min(0).optional(),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; productId: string }> }
) {
  const session = await auth()
  const { id, productId } = await params
  if (!authorize(session, id)) return Response.json({ error: "Forbidden" }, { status: 403 })
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
  const { id, productId } = await params
  if (!authorize(session, id)) return Response.json({ error: "Forbidden" }, { status: 403 })
  await prisma.product.deleteMany({ where: { id: productId, clientId: id } })
  return new Response(null, { status: 204 })
}
