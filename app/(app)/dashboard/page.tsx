import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import Dashboard from "@/components/Dashboard"

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect("/auth/signin")

  if (session.user.role === "coach") redirect("/clients")

  const clientId = session.user.clientId
  if (!clientId) redirect("/auth/signin")

  const [client, metrics, goal, contracts] = await Promise.all([
    prisma.client.findUnique({ where: { id: clientId } }),
    prisma.monthlyMetric.findMany({ where: { clientId }, orderBy: { month: "asc" } }),
    prisma.goal.findUnique({ where: { clientId } }),
    prisma.contract.findMany({ where: { clientId } }),
  ])

  if (!client) redirect("/auth/signin")

  return (
    <Dashboard
      clientId={clientId}
      clientName={client.name}
      metrics={metrics}
      contracts={contracts}
      goal={goal}
    />
  )
}
