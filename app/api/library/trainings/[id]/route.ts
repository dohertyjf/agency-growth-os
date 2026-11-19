import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { trainingSchema, setTrainingTags, uniqueSessionSlug } from "@/lib/libraryServer"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (session?.user.role !== "coach") return Response.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  const existing = await prisma.libraryTraining.findUnique({ where: { id }, select: { publishedAt: true, slug: true, title: true } })
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 })

  const parsed = trainingSchema.partial().safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: "Invalid" }, { status: 422 })
  const { tags, published, slug: wantedSlug, ...data } = parsed.data
  // Only touch the URL when it's sent; an empty one falls back to the title.
  const slug = wantedSlug === undefined ? undefined
    : await uniqueSessionSlug(wantedSlug || data.title || existing.title, id)

  // Keep the original publish date when re-saving a published training.
  const publishedAt = published === undefined ? undefined : published ? (existing.publishedAt ?? new Date()) : null
  const training = await prisma.libraryTraining.update({ where: { id }, data: { ...data, slug, publishedAt } })
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
