// Single source of truth for all derived calculations — Section 9 of BUILD_SPEC

// ── 9.1 Dashboard derived metrics (per month) ────────────────────────────────
export function grossProfit(revenue: number, salaries: number) {
  return revenue - salaries
}
export function netProfit(revenue: number, totalExpenses: number) {
  return revenue - totalExpenses
}
export function netMargin(revenue: number, totalExpenses: number) {
  return revenue > 0 ? ((revenue - totalExpenses) / revenue) * 100 : 0
}
export function momDelta(curr: number, prev: number) {
  if (prev === 0) return curr === 0 ? 0 : 100
  return ((curr - prev) / Math.abs(prev)) * 100
}

// ── 9.2 Intake calculated metrics (from Last-month column) ───────────────────
export interface IntakeData {
  leads?: number
  qualifiedLeads?: number
  newClients?: number
  newRevenue?: number
  totalClients?: number
  overallRevenue?: number
  churnedClients?: number
  churnedRevenue?: number
  marketingSpend?: number
  avgMonthsStay?: number
  peopleCost?: number
  hoursForClients?: number
}

export interface IntakeCalc {
  cac: number | null
  avgClientValuePerMo: number | null
  clientLTV: number | null
  closeRate: number | null
  peopleCostPerClient: number | null
  avgLTGP: number | null
  cacLtgp: number | null
  effectiveHourlyRate: number | null
}

export function calcIntake(d: IntakeData): IntakeCalc {
  const nc = d.newClients ?? 0
  const ql = d.qualifiedLeads ?? 0
  const tc = d.totalClients ?? 0
  const orev = d.overallRevenue ?? 0
  const ms = d.marketingSpend ?? 0
  const stay = d.avgMonthsStay ?? 0
  const pc = d.peopleCost ?? 0
  const hrs = d.hoursForClients ?? 0

  const cac = nc > 0 ? ms / nc : null
  const avgClientValuePerMo = tc > 0 ? orev / tc : null
  const clientLTV = avgClientValuePerMo != null ? avgClientValuePerMo * stay : null
  const closeRate = ql > 0 ? (nc / ql) * 100 : null
  const peopleCostPerClient = tc > 0 ? pc / tc : null
  const avgLTGP =
    avgClientValuePerMo != null && peopleCostPerClient != null
      ? (avgClientValuePerMo - peopleCostPerClient) * stay
      : null
  const cacLtgp =
    cac != null && cac > 0 && avgLTGP != null ? avgLTGP / cac : null
  const effectiveHourlyRate = hrs > 0 ? orev / hrs : null

  return { cac, avgClientValuePerMo, clientLTV, closeRate, peopleCostPerClient, avgLTGP, cacLtgp, effectiveHourlyRate }
}

// ── 9.3 Contracts — booked revenue for a given "YYYY-MM" ─────────────────────
export interface ContractRow {
  monthly: number
  start: string
  contractedThrough: string | null  // null = ongoing retainer
  status: "opportunity" | "potential" | "active" | "lost" | "finished"
  type?: "retainer" | "oneoff"
}

export function ymDiff(a: string, b: string) {
  const [ay, am] = a.split("-").map(Number)
  const [by, bm] = b.split("-").map(Number)
  return (by * 12 + bm) - (ay * 12 + am)
}

// Signed work only — the contracted floor. (Excludes qualified/opportunity
// pipeline and lost deals, so the confidence tiers stack cleanly.)
export function bookedActive(contracts: ContractRow[], ym: string) {
  return contracts
    .filter(c => (c.status === "active" || c.status === "finished") && c.start <= ym && (c.contractedThrough === null || c.contractedThrough >= ym))
    .reduce((s, c) => s + c.monthly, 0)
}

export function bookedPotential(contracts: ContractRow[], ym: string) {
  return contracts
    .filter(c => c.status === "potential" && c.start <= ym && (c.contractedThrough === null || c.contractedThrough >= ym))
    .reduce((s, c) => s + c.monthly, 0)
}

export function bookedOpportunity(contracts: ContractRow[], ym: string) {
  return contracts
    .filter(c => c.status === "opportunity" && c.start <= ym && (c.contractedThrough === null || c.contractedThrough >= ym))
    .reduce((s, c) => s + c.monthly, 0)
}

export function monthsRemaining(contract: ContractRow, now: string) {
  if (contract.contractedThrough === null) return Infinity
  return Math.max(0, ymDiff(now, contract.contractedThrough))
}

// Horizon (months) for the "Booked ahead" figure.
export const BOOKED_AHEAD_MONTHS = 6

// Committed revenue over the next `horizon` months, from signed (active) contracts only.
// Ongoing retainers count `horizon` months; fixed-term count months left, capped at the
// horizon; one-offs count if they land inside the window.
export function bookedAhead(contracts: ContractRow[], now: string, horizon = BOOKED_AHEAD_MONTHS) {
  return contracts
    .filter(c => c.status === "active")
    .reduce((s, c) => {
      if (c.type === "oneoff") {
        const d = ymDiff(now, c.contractedThrough ?? c.start)
        return s + (d > 0 && d <= horizon ? c.monthly : 0)
      }
      return s + c.monthly * Math.min(monthsRemaining(c, now), horizon)
    }, 0)
}

export function currentMRR(contracts: ContractRow[], now: string) {
  return bookedActive(contracts, now)
}

// ── 9.4 Dashboard projection (6 future months, active only) ──────────────────
export interface ProjectionInput {
  contracts: ContractRow[]
  latestTotalExpenses: number
  latestSalaries: number
  latestSoftware: number
  currentYM: string
}

export type ProjectableMetric = "revenue" | "netProfit" | "grossProfit" | "netMargin"

export function projectMetric(
  metric: ProjectableMetric,
  input: ProjectionInput
): number[] {
  const { contracts, latestTotalExpenses, latestSalaries, latestSoftware, currentYM } = input
  const futureYMs = Array.from({ length: 6 }, (_, i) => ymAdd(currentYM, i + 1))
  const revs = futureYMs.map(ym => bookedActive(contracts, ym))

  if (metric === "revenue") return revs
  if (metric === "netProfit") return revs.map(r => r - latestTotalExpenses)
  if (metric === "grossProfit") return revs.map(r => r - latestSalaries)
  if (metric === "netMargin") return revs.map(r => r > 0 ? ((r - latestTotalExpenses) / r) * 100 : 0)
  return []
}

// ── 9.6 Capacity projection ("when does the model cap out") ──────────────────
// Shared by the internal Growth Projection tool, the public Capacity
// Calculator, and the /api/leads compute step so all three stay identical.
export interface CapacityInputs {
  startRevenue: number   // current MRR
  leads: number          // leads / month
  closeRate: number      // percent (0–100)
  avgDeal: number        // monthly value per client
  churn: number          // clients lost / month
  hoursPerClient: number // avg monthly hours per client
  billableHours: number  // total monthly billable capacity
  activeClients: number  // clients served today
  goalMRR?: number | null
}

export interface CapacityResult {
  projected: number[]            // MRR for each of `months` future months
  maxClients: number | null      // clients the billable hours can serve
  mrrCap: number | null          // MRR ceiling implied by capacity
  capacityHitMonth: number       // index into projected where cap is hit, -1 if never
  goalHitMonth: number           // index where goal is reached, -1 if never / no goal
  newClientsPerMonth: number
  netMRRChange: number           // new MRR − churned MRR per month
  currentHoursUsed: number
  hoursAvailable: number
  slotsAvailable: number | null  // open client slots at current hrs/client
}

export function projectMRR(
  startMRR: number, leads: number, closeRate: number,
  avgDeal: number, churnCount: number, months: number,
  cap?: number
): number[] {
  const result: number[] = []
  let mrr = startMRR
  for (let i = 0; i < months; i++) {
    const newMRR = leads * (closeRate / 100) * avgDeal
    const churnedMRR = churnCount * avgDeal
    mrr = Math.max(0, mrr + newMRR - churnedMRR)
    if (cap !== undefined) mrr = Math.min(mrr, cap)
    result.push(Math.round(mrr))
  }
  return result
}

export function projectCapacity(inp: CapacityInputs, months = 12): CapacityResult {
  const maxClients = inp.hoursPerClient > 0 && inp.billableHours > 0
    ? Math.floor(inp.billableHours / inp.hoursPerClient)
    : null
  const mrrCap = maxClients !== null && inp.avgDeal > 0 ? maxClients * inp.avgDeal : null

  const projected = projectMRR(
    inp.startRevenue, inp.leads, inp.closeRate, inp.avgDeal, inp.churn, months,
    mrrCap ?? undefined
  )

  const capacityHitMonth = mrrCap !== null ? projected.findIndex(v => v >= mrrCap) : -1
  const goal = inp.goalMRR ?? 0
  const goalHitMonth = goal > 0 ? projected.findIndex(v => v >= goal) : -1

  const newClientsPerMonth = inp.leads * (inp.closeRate / 100)
  const netMRRChange = newClientsPerMonth * inp.avgDeal - inp.churn * inp.avgDeal

  const currentHoursUsed = inp.activeClients * inp.hoursPerClient
  const hoursAvailable = inp.billableHours - currentHoursUsed
  const slotsAvailable = inp.hoursPerClient > 0 ? Math.floor(hoursAvailable / inp.hoursPerClient) : null

  return {
    projected, maxClients, mrrCap, capacityHitMonth, goalHitMonth,
    newClientsPerMonth, netMRRChange, currentHoursUsed, hoursAvailable, slotsAvailable,
  }
}

// ── 9.6b Leads goal ("how many leads to hit a revenue goal") ─────────────────
// Revenue-based (not MRR). The average client's monthly value is derived from
// their current client count (revenue ÷ clients), and churn from how long the
// average client stays (1 ÷ months). Churn is optional — omit avgMonthsStay and
// we assume zero churn, giving a best-case "floor" number. Older submissions
// stored avgDealValue + recurringRevenue instead; those are still accepted as a
// fallback so saved reports keep recomputing.
export interface LeadsGoalInputs {
  currentRevenue: number            // R0 — collected last month
  goalRevenue: number               // G  — target monthly revenue
  closeRate: number                 // fraction 0–1 (qualified prospects → clients)
  currentClients?: number | null    // avg client value k = R0 / currentClients
  avgMonthsStay?: number | null     // churn c = 1 / avgMonthsStay; omit ⇒ no churn (floor)
  currentLeads?: number | null
  months: number                    // scenario timeframe
  // Legacy inputs (older saved submissions) — used only when the new fields are absent:
  avgDealValue?: number             // k  — revenue a new client brings their first month
  recurringRevenue?: number         // of R0, how much bills again next month (no new sale)
}

export interface LeadsGoalResult {
  valid: boolean                          // false if close rate or deal size is 0
  churnRate: number                       // c = rollOff / R0
  rollOff: number                         // D = R0 − recurring
  revenuePerLead: number                  // cr × k
  leadsToHoldCurrent: number              // replace today's roll-off
  leadsToHoldGoal: number                 // sustain the goal forever
  leadsToReachGoal: number                // reach G within `months`
  newClientsPerMonth: number
  growthLeads: number                     // of the needed leads, the portion beyond treadmill
  gap: number | null                      // needed − current (null if no current leads)
  ceilingAtCurrentLeads: number | null    // plateau revenue (null = no ceiling, 0% churn)
  reachesGoalAtCurrentLeads: boolean | null
  monthsToReachAtCurrentLeads: number | null // when they'd hit the goal at current lead pace
  runwayHalfLifeMonths: number | null     // months to halve if they stop selling (null = no decay)
  goalBelowCurrent: boolean
  alreadyEnoughLeads: boolean
}

export function leadsGoal(inp: LeadsGoalInputs): LeadsGoalResult {
  const R0 = Math.max(0, inp.currentRevenue)
  const G = Math.max(0, inp.goalRevenue)
  const cr = inp.closeRate
  const N = Math.max(1, Math.round(inp.months))

  // Average revenue per client per month (k). Prefer the current-client count
  // (revenue ÷ clients); fall back to the legacy avg-deal field for old records.
  const clients = inp.currentClients != null && inp.currentClients > 0 ? inp.currentClients : null
  const k = clients != null ? R0 / clients : Math.max(0, inp.avgDealValue ?? 0)

  // Monthly churn. Prefer avg client lifespan (1 ÷ months). Fall back to the
  // legacy recurring-revenue figure. Absent both ⇒ assume none (best-case floor).
  let churnRate: number
  if (inp.avgMonthsStay != null && inp.avgMonthsStay > 0) {
    churnRate = Math.min(1, 1 / inp.avgMonthsStay)
  } else if (inp.recurringRevenue != null) {
    const rec = Math.min(Math.max(0, inp.recurringRevenue), R0)
    churnRate = R0 > 0 ? (R0 - rec) / R0 : 0
  } else {
    churnRate = 0
  }
  const rollOff = R0 * churnRate
  const revenuePerLead = cr * k

  const base: LeadsGoalResult = {
    valid: false, churnRate, rollOff, revenuePerLead,
    leadsToHoldCurrent: 0, leadsToHoldGoal: 0, leadsToReachGoal: 0,
    newClientsPerMonth: 0, growthLeads: 0, gap: null,
    ceilingAtCurrentLeads: null, reachesGoalAtCurrentLeads: null,
    monthsToReachAtCurrentLeads: null, runwayHalfLifeMonths: null,
    goalBelowCurrent: G <= R0, alreadyEnoughLeads: false,
  }
  if (!(revenuePerLead > 0)) return base

  const c = churnRate
  const leadsToHoldCurrent = rollOff / revenuePerLead
  const leadsToHoldGoal = (c * G) / revenuePerLead

  let leadsToReachGoal: number
  if (c <= 0) {
    // No roll-off → linear growth, no ceiling.
    leadsToReachGoal = Math.max(0, (G - R0) / (N * revenuePerLead))
  } else {
    const factor = Math.pow(1 - c, N)
    leadsToReachGoal = Math.max(0, ((G - R0 * factor) * c) / (revenuePerLead * (1 - factor)))
  }

  const newClientsPerMonth = leadsToReachGoal * cr
  const growthLeads = Math.max(0, leadsToReachGoal - leadsToHoldCurrent)

  const L = inp.currentLeads != null && inp.currentLeads >= 0 ? inp.currentLeads : null
  const ceilingAtCurrentLeads = L != null ? (c > 0 ? (L * revenuePerLead) / c : null) : null
  const reachesGoalAtCurrentLeads =
    L != null ? (c > 0 ? (ceilingAtCurrentLeads as number) >= G : L > 0 ? true : R0 >= G) : null

  // Months to reach the goal at the current lead pace (invert the recurrence for N).
  let monthsToReachAtCurrentLeads: number | null = null
  if (L != null && G <= R0) {
    monthsToReachAtCurrentLeads = 0
  } else if (L != null && L > 0 && G > R0) {
    const A = L * revenuePerLead
    if (c <= 0) {
      monthsToReachAtCurrentLeads = A > 0 ? (G - R0) / A : null
    } else {
      const ceiling = A / c
      if (ceiling > G) {
        const n = Math.log((G - ceiling) / (R0 - ceiling)) / Math.log(1 - c)
        monthsToReachAtCurrentLeads = isFinite(n) && n > 0 ? n : null
      }
    }
  }

  return {
    ...base, valid: true,
    leadsToHoldCurrent, leadsToHoldGoal, leadsToReachGoal,
    newClientsPerMonth, growthLeads,
    gap: L != null ? leadsToReachGoal - L : null,
    ceilingAtCurrentLeads, reachesGoalAtCurrentLeads, monthsToReachAtCurrentLeads,
    runwayHalfLifeMonths: c > 0 ? Math.log(0.5) / Math.log(1 - c) : null,
    alreadyEnoughLeads: L != null ? L >= leadsToReachGoal : false,
  }
}

// ── 9.5 Goals (run-rate) ─────────────────────────────────────────────────────
export function mrrGoal(annualRevenueGoal: number) {
  return annualRevenueGoal / 12
}
export function goalProgress(current: number, goal: number) {
  return goal > 0 ? Math.min(100, Math.max(0, (current / goal) * 100)) : 0
}

// ── Helpers ──────────────────────────────────────────────────────────────────
export function ymAdd(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number)
  const total = y * 12 + (m - 1) + n
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  return `${ny}-${String(nm).padStart(2, "0")}`
}

export function ymLabel(ym: string): string {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  const [y, m] = ym.split("-").map(Number)
  return `${months[m - 1]} '${String(y).slice(2)}`
}

const CURRENCY_LOCALE: Record<string, string> = { USD: "en-US", GBP: "en-GB", EUR: "de-DE" }

export function fmtCurrency(v: number, currency = "USD"): string {
  const locale = CURRENCY_LOCALE[currency] ?? "en-US"
  return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(Math.round(v))
}
export function fmtPercent(v: number) {
  return (Math.round(v * 10) / 10) + "%"
}
