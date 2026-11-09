// Project ownership — who oversees how much revenue, and whether the people on
// each project have logged their hours. Feeds the Team tab's "Revenue owned"
// column and the Monthly Close-Out checks.

import { activeInMonth, projectRevenue, type ProfitContract, type AccountMonthRow, type PaymentRow, type MemberHoursRow } from "./profit"

// Target: an owner oversees at least this multiple of their own salary in
// revenue — what it takes to land ~3–4× total team cost per project.
export const DEFAULT_OWNER_MULTIPLE = 6

// Signed work running in `ym`. Current/future months: active projects only.
// Past months also count finished ones, as long as they have an end date (a
// finished ongoing retainer with no end would otherwise run forever).
export function signedInMonth(c: ProfitContract, ym: string, now: string): boolean {
  if (c.status !== "active" && c.status !== "finished") return false
  if (c.status === "finished") {
    if (ym >= now) return false
    if (!c.contractedThrough && !c.deliveryEnd) return false
  }
  return activeInMonth(c, ym, now)
}

export interface OwnedRow { contract: ProfitContract; revenue: number }

// Revenue (recognised that month) of the signed projects a person owns.
export function ownedRevenue(
  personId: string, contracts: ProfitContract[], ym: string,
  inp: { accountMonths: AccountMonthRow[]; payments: PaymentRow[] }, now: string,
): { total: number; rows: OwnedRow[] } {
  const rows = contracts
    .filter(c => c.ownerId === personId && signedInMonth(c, ym, now))
    .map(c => ({ contract: c, revenue: projectRevenue(c, ym, inp, now) }))
  return { total: rows.reduce((s, r) => s + r.revenue, 0), rows }
}

// Active projects with nobody owning them.
export function unownedProjects<C extends { status: string; ownerId?: string | null }>(contracts: C[]): C[] {
  return contracts.filter(c => c.status === "active" && !c.ownerId)
}

interface GapPerson { id: string; name: string; isExternal: boolean; startDate: string | null; endDate: string | null }
export interface HoursGap { contractId: string; contractName: string; personId: string; personName: string }

// For each signed project running in `ym`, every internal person on it (members
// plus the owner) who has no hours logged against it that month.
export function hoursGaps(
  contracts: ProfitContract[], members: { contractId: string; personId: string }[],
  people: GapPerson[], memberHours: MemberHoursRow[], ym: string, now: string,
): HoursGap[] {
  const gaps: HoursGap[] = []
  for (const c of contracts) {
    if (!signedInMonth(c, ym, now)) continue
    const ids = new Set(members.filter(m => m.contractId === c.id).map(m => m.personId))
    if (c.ownerId) ids.add(c.ownerId)
    for (const id of ids) {
      const p = people.find(x => x.id === id)
      if (!p || p.isExternal) continue
      // Not on the team that month
      if (p.startDate && p.startDate.slice(0, 7) > ym) continue
      if (p.endDate && p.endDate.slice(0, 7) < ym) continue
      const logged = memberHours.some(h => h.contractId === c.id && h.personId === id && h.month === ym && h.hours > 0)
      if (!logged) gaps.push({ contractId: c.id, contractName: c.name, personId: id, personName: p.name })
    }
  }
  return gaps
}
