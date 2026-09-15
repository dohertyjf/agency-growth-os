import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

function coachOnly(session: import("next-auth").Session | null) {
  return session?.user.role === "coach"
}

export async function GET() {
  const session = await auth()
  if (!coachOnly(session)) return Response.json({ error: "Forbidden" }, { status: 403 })
  const programs = await prisma.program.findMany({
    orderBy: [{ isGroup: "desc" }, { name: "asc" }],
    include: { _count: { select: { memberships: true, calls: true } } },
  })
  return Response.json(programs)
}

const schema = z.object({ name: z.string().min(1), isGroup: z.boolean().default(false) })

export async function POST(req: Request) {
  const session = await auth()
  if (!coachOnly(session)) return Response.json({ error: "Forbidden" }, { status: 403 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: "Name is required" }, { status: 422 })
  const program = await prisma.program.create({
    data: { name: parsed.data.name.trim(), isGroup: parsed.data.isGroup },
  })
  return Response.json(program, { status: 201 })
}
