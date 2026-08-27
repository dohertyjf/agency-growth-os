// Single source of truth for all derived calculations — Section 9 of BUILD_SPEC

// ── 9.1 Dashboard derived metrics (per month) ────────────────────────────────
export function grossProfit(revenue: number, salaries: number) {
  return revenue - salaries
}
export function netProfit(revenue: number, salaries: number, otherExpenses: number) {
  return revenue - salaries - otherExpenses
}
export function netMargin(revenue: number, salaries: number, otherExpenses: number) {
  return revenue > 0 ? ((revenue - salaries - otherExpenses) / revenue) * 100 : 0
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
  churnPct?: number      // % of clients lost / month — the preferred input
  churn?: number         // legacy: clients lost / month, converted via activeClients
  hoursPerClient: number // avg monthly hours per client
  billableHours: number  // total monthly billable capacity
  activeClients: number  // clients served today
  goalMRR?: number | null
}

// Churn as a fraction of the book per month. Submissions saved before churn
// became a percentage stored a client count instead; those are converted
// against the client count they were captured with, so old reports keep
// recomputing to the same numbers.
export function churnRateOf(inp: Pick<CapacityInputs, "churnPct" | "churn" | "activeClients">): number {
  const pct = inp.churnPct != null
    ? inp.churnPct / 100
    : inp.activeClients > 0 ? (inp.churn ?? 0) / inp.activeClients : 0
  return Math.min(1, Math.max(0, pct))
}

export interface CapacityResult {
  projected: number[]            // MRR for each of `months` future months
  maxClients: number | null      // clients the billable hours can serve
  churnRate: number              // fraction of the book lost per month
  capacityCeiling: number | null // MRR ceiling from delivery hours running out
  demandCeiling: number | null   // MRR ceiling where new wins equal churn losses
  mrrCap: number | null          // the binding ceiling — lower of the two above
  bindingConstraint: "capacity" | "demand" | null
  ceilingHitMonth: number        // index into projected where the ceiling is reached, -1 if never
  goalHitMonth: number           // index where goal is reached, -1 if never / no goal
  uncapped: number[]             // the same projection with delivery capacity kept out of the way
  hoursNeeded: number[]          // billable hours the uncapped path would require each month
  capacityRunsOutMonth: number   // first month the uncapped path needs more hours than they have, -1 if never
  hoursAtHorizon: number         // hours the uncapped path needs by the end of the projection
  newClientsPerMonth: number
  netMRRChange: number           // new MRR − churned MRR in the first month
  currentHoursUsed: number
  hoursAvailable: number
  slotsAvailable: number | null  // open client slots at current hrs/client
}

// A book is "at" its ceiling once it is within this fraction of it. The demand
// ceiling is an asymptote — revenue approaches it but never equals it — so an
// exact comparison would report "never reached" forever.
export const CEILING_REACHED_AT = 0.99

// The four inputs that can legitimately differ month to month. Everything else
// about the model (hours per client, team capacity) is a property of the agency
// rather than something you schedule.
export interface MonthDrivers {
  leads: number
  closeRate: number     // percent
  avgDeal: number
  churnPct: number       // percent of the book lost that month
  hoursPerClient: number // delivery hours each client consumes per month
  billableHours: number  // total delivery hours the team has that month
}

export interface MonthRow {
  month: number       // 1-based
  leads: number
  closeRate: number
  avgDeal: number
  churnPct: number
  hoursPerClient: number
  billableHours: number
  won: number         // clients won
  churnedClients: number
  clients: number     // at end of month
  newRev: number
  churnedRev: number
  mrr: number         // at end of month
  atCeiling: boolean
}

// The single projection engine. Callers holding every driver constant pass a
// function that ignores the month; the editable table passes one that reads its
// overrides. Avg deal size can move, so the capacity ceiling is recomputed each
// month rather than fixed up front.
export function projectSchedule(
  startRevenue: number,
  driversAt: (monthIndex: number) => MonthDrivers,
  months: number,
): MonthRow[] {
  const rows: MonthRow[] = []
  let mrr = startRevenue
  for (let i = 0; i < months; i++) {
    const d = driversAt(i)
    const churnRate = Math.min(1, Math.max(0, d.churnPct / 100))
    const won = d.leads * (d.closeRate / 100)
    const newRev = won * d.avgDeal
    const churnedRev = mrr * churnRate
    const churnedClients = d.avgDeal > 0 ? churnedRev / d.avgDeal : 0
    // Cutting delivery time per client raises how many the team can carry, so
    // the ceiling is recomputed each month alongside price.
    const maxClients = d.hoursPerClient > 0 && d.billableHours > 0
      ? Math.floor(d.billableHours / d.hoursPerClient)
      : null
    const ceiling = maxClients !== null && d.avgDeal > 0 ? maxClients * d.avgDeal : null
    let next = Math.max(0, mrr + newRev - churnedRev)
    const atCeiling = ceiling !== null && next >= ceiling
    if (ceiling !== null) next = Math.min(next, ceiling)
    mrr = next
    rows.push({
      month: i + 1,
      leads: d.leads, closeRate: d.closeRate, avgDeal: d.avgDeal, churnPct: d.churnPct,
      hoursPerClient: d.hoursPerClient, billableHours: d.billableHours,
      won, churnedClients,
      clients: d.avgDeal > 0 ? mrr / d.avgDeal : 0,
      newRev, churnedRev,
      mrr: Math.round(mrr),
      atCeiling,
    })
  }
  return rows
}

export function projectCapacity(inp: CapacityInputs, months = 12): CapacityResult {
  const maxClients = inp.hoursPerClient > 0 && inp.billableHours > 0
    ? Math.floor(inp.billableHours / inp.hoursPerClient)
    : null

  // Ceiling 1 — delivery hours run out. A hard wall: you cannot serve more.
  const capacityCeiling = maxClients !== null && inp.avgDeal > 0 ? maxClients * inp.avgDeal : null

  const churnRate = churnRateOf(inp)

  // Ceiling 2 — growth stalls where new wins equal churn losses. An asymptote,
  // not a wall, so it is never applied as a hard cap. With no churn
  // there is no demand ceiling: revenue grows without bound.
  const newMRRPerMonth = inp.leads * (inp.closeRate / 100) * inp.avgDeal
  const demandCeiling = churnRate > 0 ? newMRRPerMonth / churnRate : null

  const ceilings = [capacityCeiling, demandCeiling].filter((v): v is number => v !== null)
  const mrrCap = ceilings.length > 0 ? Math.min(...ceilings) : null
  const bindingConstraint: "capacity" | "demand" | null =
    mrrCap === null ? null
      : demandCeiling !== null && (capacityCeiling === null || demandCeiling < capacityCeiling)
        ? "demand"
        : "capacity"

  // Delegate to the scheduled engine with every driver held constant, so the
  // constant case and the edited-per-month case cannot diverge.
  const constant: MonthDrivers = {
    leads: inp.leads, closeRate: inp.closeRate, avgDeal: inp.avgDeal,
    churnPct: churnRate * 100, hoursPerClient: inp.hoursPerClient,
    billableHours: inp.billableHours,
  }
  const projected = projectSchedule(
    inp.startRevenue, () => constant, months,
  ).map(r => r.mrr)

  const ceilingHitMonth = mrrCap !== null
    ? projected.findIndex(v => v >= mrrCap * CEILING_REACHED_AT)
    : -1
  const goal = inp.goalMRR ?? 0
  const goalHitMonth = goal > 0 ? projected.findIndex(v => v >= goal) : -1

  // What the same agency would do if delivery capacity were never the limit.
  // The gap between this and `projected` is the revenue capacity is costing
  // them, and it is what says how much capacity they need to build.
  const noLimit: MonthDrivers = { ...constant, billableHours: 0 }
  const uncapped = projectSchedule(
    inp.startRevenue, () => noLimit, months,
  ).map(r => r.mrr)
  const hoursNeeded = inp.avgDeal > 0
    ? uncapped.map(v => Math.ceil((v / inp.avgDeal) * inp.hoursPerClient))
    : uncapped.map(() => 0)
  const capacityRunsOutMonth = inp.billableHours > 0
    ? hoursNeeded.findIndex(h => h > inp.billableHours)
    : -1
  const hoursAtHorizon = hoursNeeded.length > 0 ? hoursNeeded[hoursNeeded.length - 1] : 0

  const newClientsPerMonth = inp.leads * (inp.closeRate / 100)
  const netMRRChange = newMRRPerMonth - inp.startRevenue * churnRate

  const currentHoursUsed = inp.activeClients * inp.hoursPerClient
  const hoursAvailable = inp.billableHours - currentHoursUsed
  const slotsAvailable = inp.hoursPerClient > 0 ? Math.floor(hoursAvailable / inp.hoursPerClient) : null

  return {
    projected, maxClients, churnRate, capacityCeiling, demandCeiling, mrrCap,
    bindingConstraint, ceilingHitMonth, goalHitMonth,
    uncapped, hoursNeeded, capacityRunsOutMonth, hoursAtHorizon,
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

// ── Capacity (delivery hours) by month ────────────────────────────────────────
export interface CapacityContract {
  id: string
  hoursPerMonth?: number
  start: string
  contractedThrough: string | null
  status: string
  type?: string
  deliveryStart?: string | null
  deliveryEnd?: string | null
}
export interface DeliveryRow { contractId: string; month: string; hours: number }

// Planned delivery hours per month: committed (signed/active) and pipeline
// (qualified/opportunity). Retainers spread hoursPerMonth over their term;
// one-offs use their delivery-month rows, falling back to hoursPerMonth in the
// delivery/payment month when none are set.
export function capacityByMonth(
  contracts: CapacityContract[],
  deliveryMonths: DeliveryRow[],
  months: string[],
): { month: string; committed: number; pipeline: number }[] {
  const byContract = new Map<string, Map<string, number>>()
  for (const d of deliveryMonths) {
    if (!byContract.has(d.contractId)) byContract.set(d.contractId, new Map())
    byContract.get(d.contractId)!.set(d.month, d.hours)
  }
  const hoursFor = (c: CapacityContract, m: string): number => {
    const hpm = c.hoursPerMonth ?? 0
    if (c.type === "oneoff") {
      const rows = byContract.get(c.id)
      if (rows && rows.size) return rows.get(m) ?? 0
      const only = c.deliveryStart || c.start
      return m === only ? hpm : 0
    }
    const end = c.contractedThrough
    if (c.start <= m && (!end || m <= end)) return hpm
    return 0
  }
  return months.map(m => ({
    month: m,
    committed: contracts.filter(c => c.status === "active").reduce((s, c) => s + hoursFor(c, m), 0),
    pipeline: contracts.filter(c => c.status === "potential" || c.status === "opportunity").reduce((s, c) => s + hoursFor(c, m), 0),
  }))
}
