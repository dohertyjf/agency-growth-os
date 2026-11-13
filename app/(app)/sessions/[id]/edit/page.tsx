import { auth } from "@/auth"
import { notFound, redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import TrainingEditor from "@/components/library/TrainingEditor"

export default async function EditTrainingPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect("/auth/signin")
  const { id } = await params
  if (session.user.role !== "coach") redirect(`/sessions/${id}`)

  const [training, tags] = await Promise.all([
    prisma.libraryTraining.findUnique({
      where: { id },
      include: { tags: { include: { tag: true } }, sourceCall: { select: { title: true, synopsis: true } } },
    }),
    prisma.libraryTag.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
  ])
  if (!training) notFound()

  return (
    <TrainingEditor
      initial={{
        id: training.id, title: training.title, category: training.category, date: training.date ?? "",
        summary: training.summary ?? "", outline: training.outline ?? "", takeaways: training.takeaways ?? "", actionSteps: training.actionSteps ?? "",
        video: training.video ?? "", worksheet: training.worksheet ?? "", transcript: training.transcript ?? "",
        sourceCallId: training.sourceCallId, published: !!training.publishedAt,
        tags: training.tags.map(t => t.tag.name).sort(),
      }}
      allTags={tags.map(t => t.name)}
      sourceCallTitle={training.sourceCall?.title}
      synopsis={training.sourceCall?.synopsis ?? undefined}
    />
  )
}
