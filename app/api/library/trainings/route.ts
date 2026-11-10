import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { trainingSchema, setTrainingTags } from "@/lib/libraryServer"

export async function POST(req: Request) {
  const session = await auth()
  if (session?.user.role !== "coach") return Response.json({ error: "Forbidden" }, { status: 403 })
  const parsed = trainingSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: "A title and category are required" }, { status: 422 })
  const { tags, published, ...data } = parsed.data

  const training = await prisma.libraryTraining.create({
    data: { ...data, publishedAt: published ? new Date() : null },
  })
  if (tags) await setTrainingTags(training.id, tags)
  return Response.json(training, { status: 201 })
}
