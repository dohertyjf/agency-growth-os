import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const schema = z.array(z.object({
  name: z.string().min(1),
  role: z.string().optional(),
  annualSalary: z.number().min(0).default(0),
  billableHours: z.number().min(0).default(0),
})).min(1)

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const { id } = await params
  if (!session || session.user.role !== "coach") return Response.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: "Invalid", details: parsed.error.flatten() }, { status: 422 })

  const created = await prisma.$transaction(
    parsed.data.map(p => prisma.person.create({ data: { clientId: id, ...p } }))
  )
  return Response.json(created, { status: 201 })
}
