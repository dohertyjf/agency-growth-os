import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { computeInsights } from "@/lib/insights"
import InsightsClient from "./InsightsClient"

export default async function InsightsPage() {
  const session = await auth()
  if (!session) redirect("/auth/signin")

  const clientId = session.user.role === "client"
    ? session.user.clientId ?? null
    : null

  // For coaches without a clientId context, show a picker. For now redirect to clients.
  if (session.user.role === "coach") redirect("/clients")

  if (!clientId) redirect("/dashboard")

  // Compute directly from the client's recent metrics — same logic the API uses.
  const metrics = await prisma.monthlyMetric.findMany({
    where: { clientId },
    orderBy: { month: "desc" },
    take: 6,
  })
  metrics.reverse()
  const insights = computeInsights(metrics)

  return <InsightsClient clientId={clientId} insights={insights} />
}
