import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import TrainingEditor from "@/components/library/TrainingEditor"

// /sessions/new?fromCall=<callId> pre-fills the training from a call.
export default async function NewTrainingPage({ searchParams }: { searchParams: Promise<{ fromCall?: string }> }) {
  const session = await auth()
  if (!session) redirect("/auth/signin")
  if (session.user.role !== "coach") redirect("/sessions")

  const { fromCall } = await searchParams
  const [call, tags] = await Promise.all([
    fromCall ? prisma.call.findUnique({ where: { id: fromCall } }) : null,
    prisma.libraryTag.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
  ])

  return (
    <TrainingEditor
      initial={{
        title: call?.title ?? "", category: "", date: call?.date ?? "",
        summary: call?.synopsis ?? "", takeaways: "", actionSteps: "",
        video: call?.video ?? "", worksheet: "", transcript: call?.transcript ?? "",
        sourceCallId: call?.id ?? null, published: false, tags: [],
      }}
      allTags={tags.map(t => t.name)}
      sourceCallTitle={call?.title}
      synopsis={call?.synopsis ?? undefined}
    />
  )
}
