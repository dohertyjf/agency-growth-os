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

  // Clients get the full tabbed profile view (scoped to their own client by the
  // [slug]/[tab] route's owner check). Fall through to the simple dashboard only
  // for a client whose profile has no slug yet.
  const client = await prisma.client.findUnique({ where: { id: clientId } })
  if (!client) redirect("/auth/signin")
  if (client.slug) redirect(`/clients/${client.slug}/dashboard`)

  const [metrics, goal, contracts] = await Promise.all([
    prisma.monthlyMetric.findMany({ where: { clientId }, orderBy: { month: "asc" } }),
    prisma.goal.findUnique({ where: { clientId } }),
    prisma.contract.findMany({ where: { clientId } }),
  ])

  return (
    <Dashboard
      clientId={clientId}
      projectionState={client.projectionState}
      clientSlug={client.slug ?? ""}
      clientName={client.name}
      metrics={metrics}
      contracts={contracts}
      goal={goal}
    />
  )
}
