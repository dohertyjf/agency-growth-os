import { netProfit, netMargin } from "@/lib/calc"

// Phased rollout flag (server-side only). Comma-separated client slugs allowed
// to see Insights, e.g. INSIGHTS_CLIENT_SLUGS="john-doherty,acme". Unset = none.
// Lets us dogfood on one profile in production before opening it to clients.
export function insightsEnabledForSlug(slug: string | null | undefined): boolean {
  if (!slug) return false
  const allow = (process.env.INSIGHTS_CLIENT_SLUGS ?? "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
  return allow.includes(slug)
}

export interface InsightCard {
  tone: "leverage" | "good" | "watch"
  tag: string
  title: string
  body: string
  metric: string
  metricLabel: string
}

// Monthly financials come from manual entry (MonthlyMetric).
export interface InsightMetric {
  month: string // YYYY-MM
  revenue: number
  totalExpenses: number
  software: number
}

// The funnel (leads, wins) comes live from the Pipeline (Contract records).
export interface InsightContract {
  createdAt: string | Date
  signedDate?: string | null
  stageEnteredAt?: string | Date | null
  status: string
}

function ym(d: string | Date | null | undefined): string {
  if (!d) return ""
  return typeof d === "string" ? d.slice(0, 7) : new Date(d).toISOString().slice(0, 7)
}

const pct = (arr: number[]) => {
  const f = arr[0], l = arr[arr.length - 1]
  return f === 0 ? 0 : Math.round((l - f) / Math.abs(f) * 100)
}

const signed = (n: number) => `${n >= 0 ? "+" : ""}${n}`

// Rules-based insights.
//   - Leads & close rate are derived LIVE from the Pipeline: a "lead" is a deal
//     added that month (by created date); a "win" is a deal that became active
//     that month; close rate = wins / leads.
//   - Financial trends (net profit, margin, software) use MonthlyMetric but only
//     COMPLETED months — the in-progress current month is excluded so a not-yet-
//     entered month can't show a bogus -100%.
//
// `metrics` ascending by month (may include the current month). `contracts` is
// the client's full deal list. `currentMonth` is "YYYY-MM".
export function computeInsights(
  metrics: InsightMetric[],
  contracts: InsightContract[],
  currentMonth: string,
): { enabled: boolean; cards: InsightCard[] } {
  // ── Pipeline funnel by month (live) ──
  const leadsByMonth: Record<string, number> = {}
  const winsByMonth: Record<string, number> = {}
  for (const c of contracts) {
    const created = ym(c.createdAt)
    if (created) leadsByMonth[created] = (leadsByMonth[created] ?? 0) + 1
    if (c.status === "active" || c.status === "finished") {
      const wonMonth = ym(c.signedDate) || ym(c.stageEnteredAt) || created
      if (wonMonth) winsByMonth[wonMonth] = (winsByMonth[wonMonth] ?? 0) + 1
    }
  }
  const currentLeads = leadsByMonth[currentMonth] ?? 0

  // ── Completed months only (exclude the in-progress month) ──
  const completed = metrics.filter(m => m.month < currentMonth).slice(-6)
  const months = completed.map(m => m.month)
  const n = months.length
  const hasTrend = n >= 2

  const cards: InsightCard[] = []

  // ── Card 1: leads / conversion (live pipeline) ──
  if (hasTrend) {
    const leadsSeries = months.map(m => leadsByMonth[m] ?? 0)
    const winsSeries = months.map(m => winsByMonth[m] ?? 0)
    const closeSeries = months.map((_, i) => leadsSeries[i] > 0 ? (winsSeries[i] / leadsSeries[i]) * 100 : 0)
    cards.push({
      tone: "leverage",
      tag: "Highest leverage",
      title: "Tighten sales conversion before buying more traffic",
      body: `You've added ${currentLeads} ${currentLeads === 1 ? "lead" : "leads"} to the pipeline so far this month. Across the last ${n} completed months, leads moved ${signed(pct(leadsSeries))}% and close rate ${signed(pct(closeSeries))}%. Lifting close rate a few points is worth more than chasing more leads — and costs nothing.`,
      metric: "closeRate",
      metricLabel: "close rate",
    })
  } else if (currentLeads > 0) {
    cards.push({
      tone: "leverage",
      tag: "Pipeline",
      title: "Your pipeline is filling",
      body: `You've added ${currentLeads} ${currentLeads === 1 ? "lead" : "leads"} to the pipeline so far this month. Once a couple of months are complete, this will trend your lead flow and close rate.`,
      metric: "leads",
      metricLabel: "leads",
    })
  }

  // ── Cards 2 & 3: financials, completed months only ──
  if (hasTrend) {
    const np = completed.map(m => netProfit(m.revenue, m.totalExpenses))
    const nm = completed.map(m => netMargin(m.revenue, m.totalExpenses))
    const software = completed.map(m => m.software)
    const npP = pct(np)
    const nmPts = Math.round(nm[nm.length - 1] - nm[0])
    const softP = pct(software)

    const profitUp = npP >= 0
    cards.push({
      tone: profitUp ? "good" : "watch",
      tag: profitUp ? "Working well" : "Keep an eye on",
      title: profitUp ? "Net profit is trending up" : "Net profit is slipping",
      body: `Over the last ${n} completed months, net profit moved ${signed(npP)}% and net margin ${nmPts >= 0 ? "improved" : "slipped"} ${Math.abs(nmPts)} points. ${profitUp ? "Protect what's driving it." : "Worth digging into what changed."}`,
      metric: "netProfit",
      metricLabel: "net profit",
    })

    cards.push({
      tone: "watch",
      tag: "Keep an eye on",
      title: "Watch tooling creep",
      body: `Software spend moved ${signed(softP)}% over the last ${n} completed months. Audit subscriptions each quarter so fixed costs don't quietly eat into margin.`,
      metric: "software",
      metricLabel: "software spend",
    })
  }

  return { enabled: true, cards }
}
