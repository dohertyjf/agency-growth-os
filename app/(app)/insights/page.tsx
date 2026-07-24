import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
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

  // Fetch insights
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000"
  let insights: { enabled: boolean; cards: InsightCard[] } = { enabled: true, cards: [] }
  try {
    const res = await fetch(`${baseUrl}/api/clients/${clientId}/insights`, {
      headers: { Cookie: "" },
      cache: "no-store",
    })
    if (res.ok) insights = await res.json()
  } catch {}

  // Fallback: compute directly
  if (!insights.cards.length) {
    const metrics = await prisma.monthlyMetric.findMany({
      where: { clientId },
      orderBy: { month: "desc" },
      take: 6,
    })
    if (metrics.length >= 2) {
      const { netProfit, netMargin, momDelta } = await import("@/lib/calc")
      metrics.reverse()
      const pct = (arr: number[]) => {
        const f = arr[0], l = arr[arr.length - 1]
        return f === 0 ? 0 : Math.round((l - f) / Math.abs(f) * 100)
      }
      const leads = metrics.map(m => m.leads)
      const closeRate = metrics.map(m => m.closeRate)
      const np = metrics.map(m => netProfit(m.revenue, m.salaries, m.software, m.totalExpenses))
      const software = metrics.map(m => m.software)
      const nm = metrics.map(m => netMargin(m.revenue, m.salaries, m.software, m.totalExpenses))
      insights.cards = [
        {
          tone: "leverage" as const,
          tag: "Highest leverage",
          title: "Tighten sales conversion before buying more traffic",
          body: `Leads grew ${pct(leads)}% but close rate moved ${pct(closeRate)}% over the period. Lifting close rate just 3 points is worth more revenue than another lead-gen push.`,
          metric: "closeRate",
          metricLabel: "close rate",
        },
        {
          tone: "good" as const,
          tag: "Working well",
          title: "Net profit is compounding",
          body: `Net profit is up ${pct(np)}% and net margin improved ${Math.round(nm[nm.length - 1] - nm[0])} points. Protect what changed.`,
          metric: "netProfit",
          metricLabel: "net profit",
        },
        {
          tone: "watch" as const,
          tag: "Keep an eye on",
          title: "Watch tooling creep",
          body: `Software spend rose ${pct(software)}% over the period. Audit subscriptions each quarter so fixed costs don't quietly eat into margin gains.`,
          metric: "software",
          metricLabel: "software spend",
        },
      ]
    }
  }

  return <InsightsClient clientId={clientId} insights={insights} />
}

interface InsightCard {
  tone: "leverage" | "good" | "watch"
  tag: string
  title: string
  body: string
  metric: string
  metricLabel: string
}
