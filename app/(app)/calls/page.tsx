import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import CallsClient from "./CallsClient"

export default async function CallsPage() {
  const session = await auth()
  if (!session) redirect("/auth/signin")

  const isCoach = session.user.role === "coach"
  if (!isCoach && !session.user.clientId) redirect("/dashboard")
  const clientId = isCoach ? undefined : session.user.clientId!

  // Coach sees all calls; a client sees their 1:1s plus group calls for any
  // GROUP program they belong to.
  const groupProgramIds = isCoach ? [] : (await prisma.programMembership.findMany({
    where: { clientId, program: { isGroup: true } },
    select: { programId: true },
  })).map(m => m.programId)

  const calls = await prisma.call.findMany({
    where: isCoach
      ? {}
      : { OR: [{ clientId }, ...(groupProgramIds.length ? [{ isGroupCall: true, programId: { in: groupProgramIds } }] : [])] },
    include: { questions: { orderBy: { order: "asc" } } },
    orderBy: { date: "desc" },
  })

  const [clients, programs] = await Promise.all([
    isCoach ? prisma.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    isCoach ? prisma.program.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ])

  return <CallsClient calls={calls} clients={clients} programs={programs} isCoach={isCoach} defaultClientId={clientId} />
}
