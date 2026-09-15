import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { computeInsights, insightsEnabledForSlug } from "@/lib/insights"
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

  // Insights is behind the same allowlist as the profile tab — clients whose
  // profile isn't enabled can't reach it, even by direct URL.
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { slug: true } })
  if (!insightsEnabledForSlug(client?.slug)) redirect("/dashboard")

  // Same logic the API and profile tab use: funnel live from the Pipeline,
  // financials from completed months.
  const [metrics, contracts] = await Promise.all([
    prisma.monthlyMetric.findMany({ where: { clientId }, orderBy: { month: "asc" } }),
    prisma.contract.findMany({
      where: { clientId },
      select: { createdAt: true, signedDate: true, stageEnteredAt: true, status: true, monthly: true },
    }),
  ])
  const insights = computeInsights(metrics, contracts, new Date())

  return <InsightsClient clientId={clientId} insights={insights} />
}
