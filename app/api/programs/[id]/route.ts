import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

function coachOnly(session: import("next-auth").Session | null) {
  return session?.user.role === "coach"
}

const schema = z.object({
  name: z.string().min(1).optional(),
  isGroup: z.boolean().optional(),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!coachOnly(session)) return Response.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: "Invalid" }, { status: 422 })
  const data: { name?: string; isGroup?: boolean } = {}
  if (parsed.data.name !== undefined) data.name = parsed.data.name.trim()
  if (parsed.data.isGroup !== undefined) data.isGroup = parsed.data.isGroup
  const program = await prisma.program.update({ where: { id }, data })
  return Response.json(program)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!coachOnly(session)) return Response.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  // Clients/calls keep existing; their programId is set null by the FK (SetNull).
  await prisma.program.delete({ where: { id } })
  return new Response(null, { status: 204 })
}
