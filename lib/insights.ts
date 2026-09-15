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

// Only the metric fields the insight rules read.
export interface InsightMetric {
  revenue: number
  totalExpenses: number
  leads: number
  closeRate: number
  software: number
}

// Rule-based insights over a client's recent monthly metrics.
// `metrics` MUST be in ascending month order (oldest first).
//
// This is intentionally simple and templated for now. The roadmap is to make it
// diagnostic: rank which insights actually matter this period, and/or generate
// the narrative from the real numbers instead of fixed sentences.
export function computeInsights(metrics: InsightMetric[]): { enabled: boolean; cards: InsightCard[] } {
  if (metrics.length < 2) return { enabled: true, cards: [] }

  const pct = (arr: number[]) => {
    const f = arr[0], l = arr[arr.length - 1]
    return f === 0 ? 0 : Math.round((l - f) / Math.abs(f) * 100)
  }

  const leads = metrics.map(m => m.leads)
  const closeRate = metrics.map(m => m.closeRate)
  const np = metrics.map(m => netProfit(m.revenue, m.totalExpenses))
  const software = metrics.map(m => m.software)
  const nm = metrics.map(m => netMargin(m.revenue, m.totalExpenses))

  const leadsP = pct(leads)
  const closeP = pct(closeRate)
  const npP = pct(np)
  const softP = pct(software)
  const nmPts = Math.round(nm[nm.length - 1] - nm[0])
  const lastLeads = leads[leads.length - 1]

  const cards: InsightCard[] = [
    {
      tone: "leverage",
      tag: "Highest leverage",
      title: "Tighten sales conversion before buying more traffic",
      body: `Leads grew ${leadsP}% but close rate moved ${closeP}% over the period. At ${lastLeads} leads/mo, lifting close rate just 3 points is worth more revenue than another lead-gen push — and costs nothing.`,
      metric: "closeRate",
      metricLabel: "close rate",
    },
    {
      tone: "good",
      tag: "Working well",
      title: "Net profit is compounding",
      body: `Net profit is up ${npP}% and net margin improved ${nmPts} points. The pricing and delegation moves from recent calls are landing — protect what changed.`,
      metric: "netProfit",
      metricLabel: "net profit",
    },
    {
      tone: "watch",
      tag: "Keep an eye on",
      title: "Watch tooling creep",
      body: `Software spend rose ${softP}% over the period. Audit subscriptions each quarter so fixed costs don't quietly eat into the margin gains.`,
      metric: "software",
      metricLabel: "software spend",
    },
  ]

  return { enabled: true, cards }
}
