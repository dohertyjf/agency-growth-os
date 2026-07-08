import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

function authorize(session: Awaited<ReturnType<typeof auth>>, clientId: string) {
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

  const calls = await prisma.call.findMany({
    where: { clientId: id },
    include: { questions: { orderBy: { order: "asc" } } },
    orderBy: { date: "desc" },
  })
  return Response.json(calls)
}

const schema = z.object({
  title: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  transcript: z.string().optional(),
  video: z.string().optional(),
  synopsis: z.string().optional(),
  notes: z.string().optional(),
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

  const call = await prisma.call.create({
    data: { clientId: id, ...parsed.data },
    include: { questions: true },
  })
  return Response.json(call, { status: 201 })
}
