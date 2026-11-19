import { auth } from "@/auth"
import { notFound, permanentRedirect, redirect } from "next/navigation"
import { sessionParamWhere } from "@/lib/libraryServer"
import { sessionHref } from "@/lib/library"
import { prisma } from "@/lib/prisma"
import TrainingEditor from "@/components/library/TrainingEditor"

export default async function EditTrainingPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect("/auth/signin")
  const { id: param } = await params
  if (session.user.role !== "coach") redirect(`/sessions/${param}`)

  const [training, tags] = await Promise.all([
    prisma.libraryTraining.findFirst({
      where: sessionParamWhere(param),
      include: { tags: { include: { tag: true } }, sourceCall: { select: { title: true, synopsis: true } } },
    }),
    prisma.libraryTag.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
  ])
  if (!training) notFound()
  if (training.slug && param !== training.slug) permanentRedirect(`${sessionHref(training)}/edit`)

  return (
    <TrainingEditor
      initial={{
        id: training.id, slug: training.slug ?? "", title: training.title, category: training.category, date: training.date ?? "",
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
