// Single source of truth for all derived calculations — Section 9 of BUILD_SPEC

// ── 9.1 Dashboard derived metrics (per month) ────────────────────────────────
export function netProfit(revenue: number, totalExpenses: number) {
  return revenue - totalExpenses
}
export function grossProfit(revenue: number, salaries: number, software: number) {
  return revenue - salaries - software
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
  contractedThrough: string
  status: "active" | "potential"
}

export function ymDiff(a: string, b: string) {
  const [ay, am] = a.split("-").map(Number)
  const [by, bm] = b.split("-").map(Number)
  return (by * 12 + bm) - (ay * 12 + am)
}

export function bookedActive(contracts: ContractRow[], ym: string) {
  return contracts
    .filter(c => c.status !== "potential" && c.start <= ym && c.contractedThrough >= ym)
    .reduce((s, c) => s + c.monthly, 0)
}

export function bookedPotential(contracts: ContractRow[], ym: string) {
  return contracts
    .filter(c => c.status === "potential" && c.start <= ym && c.contractedThrough >= ym)
    .reduce((s, c) => s + c.monthly, 0)
}

export function monthsRemaining(contract: ContractRow, now: string) {
  return Math.max(0, ymDiff(now, contract.contractedThrough))
}

export function bookedAhead(contracts: ContractRow[], now: string) {
  return contracts
    .filter(c => c.status !== "potential")
    .reduce((s, c) => s + c.monthly * monthsRemaining(c, now), 0)
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
  if (metric === "grossProfit") return revs.map(r => r - latestSalaries - latestSoftware)
  if (metric === "netMargin") return revs.map(r => r > 0 ? ((r - latestTotalExpenses) / r) * 100 : 0)
  return []
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

export function fmtCurrency(v: number) {
  return "$" + Math.round(v).toLocaleString()
}
export function fmtPercent(v: number) {
  return (Math.round(v * 10) / 10) + "%"
}
