import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import ManageTags from "./ManageTags"

export default async function LibraryTagsPage() {
  const session = await auth()
  if (!session) redirect("/auth/signin")
  if (session.user.role !== "coach") redirect("/sessions")

  const tags = await prisma.libraryTag.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { trainings: true } } } })
  return <ManageTags initialTags={tags.map(t => ({ id: t.id, name: t.name, count: t._count.trainings }))} />
}
