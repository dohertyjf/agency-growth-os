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
  status: "active" | "potential"
  type?: "retainer" | "oneoff"
}

export function ymDiff(a: string, b: string) {
  const [ay, am] = a.split("-").map(Number)
  const [by, bm] = b.split("-").map(Number)
  return (by * 12 + bm) - (ay * 12 + am)
}

export function bookedActive(contracts: ContractRow[], ym: string) {
  return contracts
    .filter(c => c.status !== "potential" && c.start <= ym && (c.contractedThrough === null || c.contractedThrough >= ym))
    .reduce((s, c) => s + c.monthly, 0)
}

export function bookedPotential(contracts: ContractRow[], ym: string) {
  return contracts
    .filter(c => c.status === "potential" && c.start <= ym && (c.contractedThrough === null || c.contractedThrough >= ym))
    .reduce((s, c) => s + c.monthly, 0)
}

export function monthsRemaining(contract: ContractRow, now: string) {
  if (contract.contractedThrough === null) return Infinity
  return Math.max(0, ymDiff(now, contract.contractedThrough))
}

export function bookedAhead(contracts: ContractRow[], now: string) {
  return contracts
    .filter(c => c.status !== "potential")
    .reduce((s, c) => {
      if (c.type === "oneoff") return s + ((c.contractedThrough ?? now) >= now ? c.monthly : 0)
      if (c.contractedThrough === null) return s  // ongoing — infinite, exclude from booked total
      return s + c.monthly * monthsRemaining(c, now)
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
