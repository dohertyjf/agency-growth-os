import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import ProgramsClient from "./ProgramsClient"

export default async function ProgramsPage() {
  const session = await auth()
  if (!session) redirect("/auth/signin")
  if (session.user.role !== "coach") redirect("/dashboard")

  const [programs, clients] = await Promise.all([
    prisma.program.findMany({
      orderBy: [{ isGroup: "desc" }, { name: "asc" }],
      include: {
        memberships: { select: { clientId: true } },
        _count: { select: { calls: true } },
      },
    }),
    prisma.client.findMany({ select: { id: true, name: true, status: true }, orderBy: { name: "asc" } }),
  ])

  return (
    <ProgramsClient
      initialPrograms={programs.map(p => ({
        id: p.id,
        name: p.name,
        isGroup: p.isGroup,
        callCount: p._count.calls,
        clientIds: p.memberships.map(m => m.clientId),
      }))}
      allClients={clients}
    />
  )
}
