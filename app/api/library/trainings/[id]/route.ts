import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { trainingSchema, setTrainingTags } from "@/lib/libraryServer"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (session?.user.role !== "coach") return Response.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  const existing = await prisma.libraryTraining.findUnique({ where: { id }, select: { publishedAt: true } })
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 })

  const parsed = trainingSchema.partial().safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: "Invalid" }, { status: 422 })
  const { tags, published, ...data } = parsed.data

  // Keep the original publish date when re-saving a published training.
  const publishedAt = published === undefined ? undefined : published ? (existing.publishedAt ?? new Date()) : null
  const training = await prisma.libraryTraining.update({ where: { id }, data: { ...data, publishedAt } })
  if (tags) await setTrainingTags(id, tags)
  return Response.json(training)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (session?.user.role !== "coach") return Response.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  // The source call is untouched; only the library copy goes.
  await prisma.libraryTraining.delete({ where: { id } })
  return new Response(null, { status: 204 })
}
