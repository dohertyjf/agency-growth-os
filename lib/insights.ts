import { netProfit, netMargin, fmtCurrency } from "@/lib/calc"

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

// The funnel comes live from the Pipeline (Contract records).
export interface InsightContract {
  createdAt: string | Date
  signedDate?: string | null
  stageEnteredAt?: string | Date | null
  status: string
  monthly: number
}

const DAY_MS = 24 * 60 * 60 * 1000

function toTime(d: string | Date | null | undefined): number | null {
  if (!d) return null
  const t = (typeof d === "string" ? new Date(d) : d).getTime()
  return isNaN(t) ? null : t
}

const pct = (arr: number[]) => {
  const f = arr[0], l = arr[arr.length - 1]
  return f === 0 ? 0 : Math.round((l - f) / Math.abs(f) * 100)
}

const signedPct = (n: number) => `${n >= 0 ? "+" : ""}${n}%`

// Rules-based insights, two frames that suit the data:
//   - PIPELINE (leads, win rate, deal size): trailing 30 days vs the prior 30.
//     A calendar-month view is misleading for a lagging funnel (deals created
//     this month rarely close this month), so we use rolling 30-day windows.
//     Leads = deals created in the window; win rate = won / (won+lost) among
//     deals that RESOLVED in the window; deal size = avg monthly value of wins.
//   - FINANCIALS (net profit, margin, software): completed calendar months only,
//     so a not-yet-entered current month can't show a bogus -100%.
//
// `metrics` ascending by month; `contracts` the client's full deal list; `now`
// the reference instant (usually new Date()).
export function computeInsights(
  metrics: InsightMetric[],
  contracts: InsightContract[],
  now: Date,
): { enabled: boolean; cards: InsightCard[] } {
  const cards: InsightCard[] = []
  const t0 = now.getTime()
  const last30 = t0 - 30 * DAY_MS
  const prior60 = t0 - 60 * DAY_MS

  // ── Pipeline (trailing 30 days) ──
  const createdIn = (start: number, end: number) =>
    contracts.filter(c => { const t = toTime(c.createdAt); return t !== null && t >= start && t < end })

  const wonResolvedIn = (start: number, end: number) =>
    contracts.filter(c => {
      if (c.status !== "active" && c.status !== "finished") return false
      const t = toTime(c.signedDate) ?? toTime(c.stageEnteredAt)
      return t !== null && t >= start && t < end
    })
  const lostResolvedIn = (start: number, end: number) =>
    contracts.filter(c => {
      if (c.status !== "lost") return false
      const t = toTime(c.stageEnteredAt)
      return t !== null && t >= start && t < end
    })

  const leadsLast = createdIn(last30, t0 + 1).length
  const leadsPrior = createdIn(prior60, last30).length
  const leadDelta = leadsLast - leadsPrior

  const wonLast = wonResolvedIn(last30, t0 + 1)
  const lostLast = lostResolvedIn(last30, t0 + 1)
  const wonPrior = wonResolvedIn(prior60, last30)
  const lostPrior = lostResolvedIn(prior60, last30)

  const winRate = (won: number, lost: number) => (won + lost) > 0 ? Math.round((won / (won + lost)) * 100) : null
  const wrLast = winRate(wonLast.length, lostLast.length)
  const wrPrior = winRate(wonPrior.length, lostPrior.length)

  const avgSize = (deals: InsightContract[]) =>
    deals.length ? deals.reduce((s, c) => s + (c.monthly || 0), 0) / deals.length : null
  const sizeLast = avgSize(wonLast)
  const sizePrior = avgSize(wonPrior)

  const hasPipelineActivity = leadsLast + leadsPrior + wonLast.length + lostLast.length > 0
  if (hasPipelineActivity) {
    const parts: string[] = []

    // Lead flow
    let lead = `You added ${leadsLast} ${leadsLast === 1 ? "lead" : "leads"} in the last 30 days`
    if (leadsLast > 0 || leadsPrior > 0) {
      lead += leadDelta > 0 ? ` — ${leadDelta} more than the prior 30`
        : leadDelta < 0 ? ` — ${Math.abs(leadDelta)} fewer than the prior 30`
        : ` — same as the prior 30`
    }
    parts.push(lead + ".")

    // Win rate (resolved deals only)
    if (wrLast !== null) {
      let s = `Of deals that resolved, ${wrLast}% closed`
      if (wrPrior !== null) s += `, vs ${wrPrior}% the prior 30`
      parts.push(s + ".")
    }

    // Average deal size (won deals)
    if (sizeLast !== null) {
      let s = `Won deals averaged ${fmtCurrency(sizeLast)}/mo`
      if (sizePrior !== null && sizePrior > 0) {
        s += ` (${signedPct(Math.round((sizeLast - sizePrior) / sizePrior * 100))})`
      }
      parts.push(s + ".")
    }

    cards.push({
      tone: "leverage",
      tag: "Pipeline · last 30 days",
      title: "Pipeline momentum",
      body: parts.join(" "),
      metric: "leads",
      metricLabel: "leads",
    })
  }

  // ── Financials (completed calendar months only) ──
  const currentMonth = now.toISOString().slice(0, 7)
  const completed = metrics.filter(m => m.month < currentMonth).slice(-6)
  const n = completed.length
  if (n >= 2) {
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
      body: `Over the last ${n} completed months, net profit moved ${signedPct(npP)} and net margin ${nmPts >= 0 ? "improved" : "slipped"} ${Math.abs(nmPts)} points. ${profitUp ? "Protect what's driving it." : "Worth digging into what changed."}`,
      metric: "netProfit",
      metricLabel: "net profit",
    })

    cards.push({
      tone: "watch",
      tag: "Keep an eye on",
      title: "Watch tooling creep",
      body: `Software spend moved ${signedPct(softP)} over the last ${n} completed months. Audit subscriptions each quarter so fixed costs don't quietly eat into margin.`,
      metric: "software",
      metricLabel: "software spend",
    })
  }

  return { enabled: true, cards }
}
