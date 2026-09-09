import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { CurrencyProvider } from "@/lib/CurrencyContext"
import WeeklyTracker from "@/components/WeeklyTracker"

// A client's own weekly tracker. Coaches reach the same thing per client on
// the Weekly tab of a client page.
export default async function TrackerPage() {
  const session = await auth()
  if (!session) redirect("/auth/signin")
  if (session.user.role === "coach") redirect("/clients")

  const clientId = session.user.clientId
  if (!clientId) redirect("/auth/signin")

  const [goal, rows] = await Promise.all([
    prisma.goal.findUnique({ where: { clientId } }),
    prisma.weeklyMetric.findMany({ where: { clientId }, orderBy: { weekStart: "asc" } }),
  ])

  return (
    <CurrencyProvider currency={goal?.currency ?? "USD"}>
      <WeeklyTracker
        clientId={clientId}
        initialRows={rows.map(w => ({
          weekStart: w.weekStart,
          leads: w.leads,
          callsScheduled: w.callsScheduled,
          callsHeld: w.callsHeld,
          deepDives: w.deepDives,
          proposalsSent: w.proposalsSent,
          newClients: w.newClients,
          marketingSpend: w.marketingSpend,
          revenue: w.revenue,
        }))}
      />
    </CurrencyProvider>
  )
}
