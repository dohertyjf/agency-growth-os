import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { normalizeTags } from "@/lib/library"

const schema = z.object({ name: z.string().min(1) })

// Renaming onto an existing tag merges the two.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (session?.user.role !== "coach") return Response.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  const parsed = schema.safeParse(await req.json().catch(() => null))
  const name = parsed.success ? normalizeTags([parsed.data.name])[0] : undefined
  if (!name) return Response.json({ error: "Invalid" }, { status: 422 })

  const target = await prisma.libraryTag.findUnique({ where: { name } })
  if (!target) return Response.json(await prisma.libraryTag.update({ where: { id }, data: { name } }))
  if (target.id === id) return Response.json(target)

  const links = await prisma.libraryTrainingTag.findMany({ where: { tagId: id }, select: { trainingId: true } })
  await prisma.$transaction([
    prisma.libraryTrainingTag.createMany({ data: links.map(l => ({ trainingId: l.trainingId, tagId: target.id })), skipDuplicates: true }),
    prisma.libraryTag.delete({ where: { id } }),
  ])
  return Response.json({ ...target, mergedFrom: id })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (session?.user.role !== "coach") return Response.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  await prisma.libraryTag.delete({ where: { id } })
  return new Response(null, { status: 204 })
}
