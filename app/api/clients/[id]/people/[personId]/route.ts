import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

async function authorizePerson(session: import("next-auth").Session | null, clientId: string, personId: string) {
  if (!session) return false
  if (session.user.role === "coach") return true
  if (session.user.clientId !== clientId) return false
  const person = await prisma.person.findUnique({ where: { id: personId } })
  return person?.clientId === clientId
}

const schema = z.object({
  name: z.string().min(1).optional(),
  role: z.string().nullable().optional(),
  annualSalary: z.number().min(0).optional(),
  billableHours: z.number().min(0).optional(),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; personId: string }> }
) {
  const session = await auth()
  const { id, personId } = await params
  if (!await authorizePerson(session, id, personId)) return Response.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: "Invalid" }, { status: 422 })

  const person = await prisma.person.update({ where: { id: personId }, data: parsed.data })
  return Response.json(person)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; personId: string }> }
) {
  const session = await auth()
  const { id, personId } = await params
  if (!await authorizePerson(session, id, personId)) return Response.json({ error: "Forbidden" }, { status: 403 })

  await prisma.person.delete({ where: { id: personId } })
  return new Response(null, { status: 204 })
}
