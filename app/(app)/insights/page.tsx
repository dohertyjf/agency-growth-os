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

  // Same logic the API and profile tab use: funnel live from the Pipeline,
  // financials from completed months.
  const [metrics, contracts] = await Promise.all([
    prisma.monthlyMetric.findMany({ where: { clientId }, orderBy: { month: "asc" } }),
    prisma.contract.findMany({
      where: { clientId },
      select: { createdAt: true, signedDate: true, stageEnteredAt: true, status: true },
    }),
  ])
  const currentMonth = new Date().toISOString().slice(0, 7)
  const insights = computeInsights(metrics, contracts, currentMonth)

  return <InsightsClient clientId={clientId} insights={insights} />
}
