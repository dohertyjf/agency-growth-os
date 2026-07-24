import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

function coachOnly(session: import("next-auth").Session | null) {
  return session?.user.role === "coach"
}

const schema = z.object({
  key: z.string().min(1),
  status: z.enum(["none", "red", "yellow", "green"]),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!coachOnly(session)) return Response.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: "Invalid" }, { status: 422 })
  const { key, status } = parsed.data
  const item = await prisma.roadmapItem.upsert({
    where: { clientId_key: { clientId: id, key } },
    create: { clientId: id, key, status },
    update: { status },
  })
  return Response.json(item)
}
