// Per-project profit — the one place the P&L math lives, shared by the project
// page, the Projects tab's Profit view and the account roll-up.
//
//   margin = revenue − team cost − direct costs
//
// Team cost is hours × each person's cost/hr (salary ÷ billable hours, with the
// per-month overrides from the Team tab). Direct costs are the project's cost
// line items (content, vendors, ads…). Reimbursed items are shown but never
// subtracted. This is contribution margin — overhead isn't allocated (yet).

export interface ProfitContract {
  id: string
  name: string
  monthly: number          // one-offs: the total project price
  hoursPerMonth: number
  start: string
  contractedThrough: string | null
  status: string
  type: string
  accountId?: string | null
  ownerId?: string | null
  deliveryStart?: string | null
  deliveryEnd?: string | null
}
export interface ProfitPerson {
  id: string
  name: string
  isExternal: boolean
  annualSalary: number
  billableHours: number
}
export interface SalaryMonthRow { personId: string; month: string; monthlySalary: number }
export interface CapacityMonthRow { personId: string; month: string; monthlyHours: number }
export interface MemberHoursRow { contractId: string; personId: string; month: string; hours: number }
export interface ContractHoursRow { contractId: string; month: string; hours: number }
export interface CostItemRow { id: string; contractId: string; name: string; category: string; reimbursed: boolean }
export interface CostMonthRow { costItemId: string; month: string; amount: number }
export interface AccountMonthRow { contractId: string; month: string; actual: number }
export interface PaymentRow { contractId: string; month: string; amount: number }

export interface ProfitInputs {
  people: ProfitPerson[]
  salaryMonths: SalaryMonthRow[]
  capacityMonths: CapacityMonthRow[]
  memberHours: MemberHoursRow[]
  contractHours: ContractHoursRow[]   // legacy per-project totals, used when no per-person rows exist
  costItems: CostItemRow[]
  costMonths: CostMonthRow[]
  accountMonths: AccountMonthRow[]
  payments: PaymentRow[]
}

export interface MonthPnl {
  month: string
  revenue: number
  hours: number
  teamCost: number
  directCost: number
  reimbursed: number
  margin: number
  marginPct: number | null   // null when there's no revenue
  perHr: number | null       // revenue ÷ hours
  costPerHr: number | null   // team cost ÷ hours
  missingRates: string[]     // people with hours logged but no cost rate
  // Set on lifetime totals: how many delivery months had anything logged, out
  // of how many have elapsed. Months with nothing logged are left out of the
  // total — revenue with unknown cost isn't profit.
  loggedMonths?: number
  elapsedMonths?: number
}

export const COST_CATEGORIES = [
  { key: "content", label: "Content" },
  { key: "ads", label: "Ad spend" },
  { key: "software", label: "Software" },
  { key: "vendor", label: "Vendor / freelancer" },
  { key: "other", label: "Other" },
] as const

export function ymAdd(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number)
  const t = y * 12 + (m - 1) + n
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`
}
export function ymSpan(a: string, b: string): string[] {
  const out: string[] = []
  const [ay, am] = a.split("-").map(Number)
  const [by, bm] = b.split("-").map(Number)
  for (let t = ay * 12 + am - 1; t <= by * 12 + bm - 1; t++) {
    out.push(`${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`)
  }
  return out
}

// Delivery window — when the work happens. Retainers run their contracted term
// (ongoing = through `now`). One-offs run their delivery window, decoupled from
// payment, falling back to the contracted term then a single month, matching the
// client page's auto-finish rule.
export function deliveryWindow(c: ProfitContract, now: string): { start: string; end: string } {
  if (c.type === "oneoff") {
    const start = c.deliveryStart || c.start
    return { start, end: c.deliveryEnd || c.contractedThrough || start }
  }
  return { start: c.start, end: c.contractedThrough ?? now }
}
export function deliveryMonths(c: ProfitContract, now: string): string[] {
  const { start, end } = deliveryWindow(c, now)
  return ymSpan(start, end < start ? start : end)
}
export function activeInMonth(c: ProfitContract, ym: string, now: string): boolean {
  const { start, end } = deliveryWindow(c, now)
  return start <= ym && ym <= end
}

// Cost per hour for a person in a month: that month's salary ÷ that month's
// billable hours, using the Team tab's overrides when set. Null when we can't
// price them (no salary or no hours) — the caller flags it rather than hiding a 0.
export function personCostRate(
  person: ProfitPerson, month: string,
  salaryMonths: SalaryMonthRow[], capacityMonths: CapacityMonthRow[],
): number | null {
  const salary = salaryMonths.find(s => s.personId === person.id && s.month === month)?.monthlySalary ?? person.annualSalary / 12
  const hours = capacityMonths.find(h => h.personId === person.id && h.month === month)?.monthlyHours ?? person.billableHours
  if (!(salary > 0) || !(hours > 0)) return null
  return salary / hours
}

// Revenue recognised in a month. Retainers: the reconciled actual, else the fee.
// One-offs: the total (payments if any are logged, else the price) spread evenly
// across the delivery months so margin lands where the work did.
export function projectRevenue(c: ProfitContract, month: string, inp: Pick<ProfitInputs, "accountMonths" | "payments">, now: string): number {
  if (!activeInMonth(c, month, now)) return 0
  if (c.type === "oneoff") {
    const paid = inp.payments.filter(p => p.contractId === c.id).reduce((s, p) => s + p.amount, 0)
    const total = paid > 0 ? paid : c.monthly
    return total / deliveryMonths(c, now).length
  }
  const am = inp.accountMonths.find(a => a.contractId === c.id && a.month === month)
  return am ? am.actual : c.monthly
}

// Hours on a project in a month: the per-person rows when any exist, else the
// legacy project total logged on the Yield view.
export function projectHours(contractId: string, month: string, inp: Pick<ProfitInputs, "memberHours" | "contractHours">): number {
  const rows = inp.memberHours.filter(h => h.contractId === contractId && h.month === month)
  if (rows.length) return rows.reduce((s, h) => s + h.hours, 0)
  return inp.contractHours.find(h => h.contractId === contractId && h.month === month)?.hours ?? 0
}
export function hasMemberHours(contractId: string, month: string, inp: Pick<ProfitInputs, "memberHours">): boolean {
  return inp.memberHours.some(h => h.contractId === contractId && h.month === month && h.hours > 0)
}

export function projectMonthPnl(c: ProfitContract, month: string, inp: ProfitInputs, now: string): MonthPnl {
  const revenue = projectRevenue(c, month, inp, now)
  const hours = projectHours(c.id, month, inp)

  let teamCost = 0
  const missingRates: string[] = []
  for (const h of inp.memberHours.filter(r => r.contractId === c.id && r.month === month && r.hours > 0)) {
    const person = inp.people.find(p => p.id === h.personId)
    if (!person) continue
    const rate = personCostRate(person, month, inp.salaryMonths, inp.capacityMonths)
    if (rate == null) { missingRates.push(person.name); continue }
    teamCost += h.hours * rate
  }

  let directCost = 0, reimbursed = 0
  for (const item of inp.costItems.filter(i => i.contractId === c.id)) {
    const amt = inp.costMonths.find(m => m.costItemId === item.id && m.month === month)?.amount ?? 0
    if (item.reimbursed) reimbursed += amt
    else directCost += amt
  }

  const margin = revenue - teamCost - directCost
  return {
    month, revenue, hours, teamCost, directCost, reimbursed, margin,
    marginPct: revenue > 0 ? (margin / revenue) * 100 : null,
    perHr: hours > 0 ? revenue / hours : null,
    costPerHr: hours > 0 ? teamCost / hours : null,
    missingRates,
  }
}

// Sum of months — "project to date" (or "final", once finished).
export function sumPnl(months: MonthPnl[], label = "total"): MonthPnl {
  const t = months.reduce((s, m) => ({
    revenue: s.revenue + m.revenue, hours: s.hours + m.hours, teamCost: s.teamCost + m.teamCost,
    directCost: s.directCost + m.directCost, reimbursed: s.reimbursed + m.reimbursed,
  }), { revenue: 0, hours: 0, teamCost: 0, directCost: 0, reimbursed: 0 })
  const margin = t.revenue - t.teamCost - t.directCost
  const missing = Array.from(new Set(months.flatMap(m => m.missingRates)))
  return {
    month: label, ...t, margin,
    marginPct: t.revenue > 0 ? (margin / t.revenue) * 100 : null,
    perHr: t.hours > 0 ? t.revenue / t.hours : null,
    costPerHr: t.hours > 0 ? t.teamCost / t.hours : null,
    missingRates: missing,
  }
}

// A month counts as logged once it has hours or a cost against it.
export function isLogged(p: MonthPnl): boolean {
  return p.hours > 0 || p.directCost > 0 || p.reimbursed > 0
}

// Project to date (or final): only the months that were actually logged, so
// early months with revenue but no hours don't inflate the margin.
export function projectLifetimePnl(c: ProfitContract, inp: ProfitInputs, now: string): MonthPnl {
  const through = deliveryWindow(c, now).end < now ? deliveryWindow(c, now).end : now
  const months = deliveryMonths(c, now).filter(m => m <= through)
  const all = months.map(m => projectMonthPnl(c, m, inp, now))
  const logged = all.filter(isLogged)
  return { ...sumPnl(logged, "lifetime"), loggedMonths: logged.length, elapsedMonths: all.length }
}
