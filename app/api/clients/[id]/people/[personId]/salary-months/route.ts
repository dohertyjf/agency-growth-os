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
  month: z.string().regex(/^\d{4}-\d{2}$/),
  monthlySalary: z.number().min(0),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; personId: string }> }
) {
  const session = await auth()
  const { id, personId } = await params
  if (!await authorizePerson(session, id, personId)) return Response.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: "Invalid" }, { status: 422 })

  const { month, monthlySalary } = parsed.data
  const record = await prisma.personSalaryMonth.upsert({
    where: { personId_month: { personId, month } },
    update: { monthlySalary },
    create: { personId, month, monthlySalary },
  })
  return Response.json(record)
}
