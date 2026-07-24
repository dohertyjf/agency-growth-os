import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

function authorize(session: import("next-auth").Session | null, clientId: string) {
  if (!session) return false
  if (session.user.role === "coach") return true
  return session.user.clientId === clientId
}

const schema = z.object({
  name: z.string().min(1).optional(),
  contactName: z.string().optional().nullable(),
  contactEmail: z.string().email().optional().nullable().or(z.literal("")),
  notes: z.string().optional().nullable(),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; accountId: string }> }
) {
  const session = await auth()
  const { id, accountId } = await params
  if (!authorize(session, id)) return Response.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: "Invalid" }, { status: 422 })

  const account = await prisma.account.updateMany({
    where: { id: accountId, clientId: id },
    data: parsed.data,
  })
  if (account.count === 0) return Response.json({ error: "Not found" }, { status: 404 })

  const updated = await prisma.account.findUnique({ where: { id: accountId } })
  return Response.json(updated)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; accountId: string }> }
) {
  const session = await auth()
  const { id, accountId } = await params
  if (!authorize(session, id)) return Response.json({ error: "Forbidden" }, { status: 403 })

  await prisma.account.deleteMany({ where: { id: accountId, clientId: id } })
  return new Response(null, { status: 204 })
}
