import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

function authorize(session: import("next-auth").Session | null, clientId: string) {
  if (!session) return false
  if (session.user.role === "coach") return true
  return session.user.clientId === clientId
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const { id } = await params
  if (!authorize(session, id)) return Response.json({ error: "Forbidden" }, { status: 403 })

  const people = await prisma.person.findMany({ where: { clientId: id }, orderBy: { createdAt: "asc" } })
  return Response.json(people)
}

const schema = z.object({
  name: z.string().min(1),
  role: z.string().optional(),
  responsibilities: z.string().nullable().optional(),
  isExternal: z.boolean().default(false),
  isFullTime: z.boolean().default(true),
  annualSalary: z.number().min(0).default(0),
  billableHours: z.number().min(0),
})

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

  const person = await prisma.person.create({ data: { clientId: id, ...parsed.data } })
  return Response.json(person, { status: 201 })
}
