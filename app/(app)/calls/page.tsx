import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import CallsClient from "./CallsClient"

export default async function CallsPage() {
  const session = await auth()
  if (!session) redirect("/auth/signin")

  const clientId = session.user.role === "client" ? (session.user.clientId ?? undefined) : undefined

  const calls = await prisma.call.findMany({
    where: clientId ? { clientId } : {},
    include: { questions: { orderBy: { order: "asc" } } },
    orderBy: { date: "desc" },
  })

  const clients = session.user.role === "coach"
    ? await prisma.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
    : []

  return <CallsClient calls={calls} clients={clients} isCoach={session.user.role === "coach"} defaultClientId={clientId} />
}
