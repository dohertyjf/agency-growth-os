import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { canSeeSessions } from "@/lib/libraryServer"

const schema = z.object({ doneSteps: z.array(z.number().int().min(0).max(200)).max(200) })

// A client ticks off "Implement this" steps on a published training.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const clientId = session?.user.clientId
  if (!session || !clientId || !(await canSeeSessions(session.user))) return Response.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  const training = await prisma.libraryTraining.findFirst({ where: { id, publishedAt: { not: null } }, select: { id: true } })
  if (!training) return Response.json({ error: "Not found" }, { status: 404 })

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: "Invalid" }, { status: 422 })
  const doneSteps = [...new Set(parsed.data.doneSteps)].sort((a, b) => a - b)
  await prisma.libraryProgress.upsert({
    where: { clientId_trainingId: { clientId, trainingId: id } },
    create: { clientId, trainingId: id, doneSteps },
    update: { doneSteps },
  })
  return Response.json({ doneSteps })
}
