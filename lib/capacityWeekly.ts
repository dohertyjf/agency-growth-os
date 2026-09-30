// Weekly capacity: sold delivery hours per project per week vs. what the team
// can deliver that week — the "when do we hit capacity / when do we hire" view.
//
// Everything upstream is monthly (hoursPerMonth, delivery months, billable
// hours), so a week's figure is the sum of its seven days, each day carrying
// 1/daysInMonth of its month. A week straddling Sep/Oct therefore blends both
// months, and a person hired mid-week counts only from their start day.
//
// Weeks run Sunday–Saturday to match the weekly tracker (lib/weeks.ts).

import { plannedHoursFn, budgetedHours, ymAdd, ymDiff, type CapacityContract, type DeliveryRow } from "./calc"
import { weekAdd, type WeekStart } from "./weeks"

const DAY = 86400000

export interface CapacityPerson {
  id: string
  isExternal: boolean
  isFullTime: boolean
  billableHours: number // monthly
  startDate: string | null // YYYY-MM-DD (or YYYY-MM)
  endDate: string | null
}
export interface CapacityMonthOverride { personId: string; month: string; monthlyHours: number }

/** A hand-set week for one project; replaces that week's share of the monthly plan. */
export interface DeliveryWeekRow { contractId: string; week: WeekStart; hours: number }

export type Stage = "committed" | "verbal" | "qualified" | "opportunity"
export const stageOf = (status: string, verbal?: boolean): Stage | null =>
  status === "active" ? "committed"
    : status === "potential" ? (verbal ? "verbal" : "qualified")
    : status === "opportunity" ? "opportunity" : null

export interface ForecastInput extends CapacityContract { monthly: number }

/**
 * Make a project forecastable, returning what was assumed:
 *
 * - **Estimated hours** — a project with no hours/month (and, for one-offs, no
 *   delivery months) gets its fee ÷ the Minimum Hourly Yield, the same default
 *   the new-project form fills in. One-offs: the total fee → total hours.
 * - **Slipped start** — an unsigned deal dated to start before next month
 *   hasn't started; its whole window (end date and delivery months included)
 *   shifts so it starts next month, keeping its length.
 */
export function forecastContract<C extends ForecastInput>(
  c: C, deliveryMonths: DeliveryRow[], nowYM: string, minHourlyRate: number | null | undefined,
): { contract: C; deliveryMonths: DeliveryRow[]; estimated: boolean; slippedFrom: string | null } {
  let rows = deliveryMonths.filter(d => d.contractId === c.id && d.hours > 0)
  let out: C = c
  let estimated = false
  if (!(c.hoursPerMonth && c.hoursPerMonth > 0) && !(c.type === "oneoff" && rows.length) && c.monthly > 0) {
    out = { ...out, hoursPerMonth: budgetedHours(c.monthly, minHourlyRate) }
    estimated = out.hoursPerMonth! > 0
  }

  let slippedFrom: string | null = null
  const earliest = ymAdd(nowYM, 1)
  const begins = c.type === "oneoff"
    ? [c.deliveryStart || c.start, ...rows.map(r => r.month)].reduce((a, b) => a < b ? a : b)
    : c.start
  if (c.status !== "active" && begins < earliest) {
    const by = ymDiff(begins, earliest)
    const shift = (ym: string | null | undefined) => ym ? ymAdd(ym, by) : ym
    slippedFrom = begins
    out = {
      ...out,
      start: ymAdd(c.start, by),
      contractedThrough: shift(c.contractedThrough) ?? null,
      deliveryStart: shift(c.deliveryStart),
      deliveryEnd: shift(c.deliveryEnd),
    }
    rows = rows.map(r => ({ ...r, month: ymAdd(r.month, by) }))
  }
  return { contract: out, deliveryMonths: rows, estimated, slippedFrom }
}

function daysOf(week: WeekStart): string[] {
  const t = new Date(`${week}T00:00:00Z`).getTime()
  return Array.from({ length: 7 }, (_, i) => new Date(t + i * DAY).toISOString().slice(0, 10))
}
function daysInMonth(ym: string): number {
  const [y, m] = ym.split("-").map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/** Spread a monthly figure over one week's days; `perMonth` also gets the day (YYYY-MM-DD). */
function weekSum(week: WeekStart, perMonth: (ym: string, day: string) => number): number {
  let total = 0
  for (const d of daysOf(week)) {
    const ym = d.slice(0, 7)
    total += perMonth(ym, d) / daysInMonth(ym)
  }
  return total
}

export function weeksFrom(start: WeekStart, n: number): WeekStart[] {
  return Array.from({ length: n }, (_, i) => weekAdd(start, i))
}

/** Planned hours for one project in each week, with any hand-set weeks taking precedence. */
export function projectHoursByWeek(
  c: CapacityContract, deliveryMonths: DeliveryRow[], deliveryWeeks: DeliveryWeekRow[], weeks: WeekStart[],
): { hours: number[]; edited: boolean[]; planned: number[] } {
  const hoursFor = plannedHoursFn(deliveryMonths)
  const set = new Map(deliveryWeeks.filter(d => d.contractId === c.id).map(d => [d.week, d.hours]))
  const planned = weeks.map(w => weekSum(w, ym => hoursFor(c, ym)))
  return {
    planned,
    hours: weeks.map((w, i) => set.get(w) ?? planned[i]),
    edited: weeks.map(w => set.has(w)),
  }
}

/** Deliverable team hours in each week, honouring start/end dates and month overrides. */
export function teamCapacityByWeek(
  people: CapacityPerson[],
  overrides: CapacityMonthOverride[],
  weeks: WeekStart[],
  includeExternal: boolean,
): number[] {
  const ov = new Map(overrides.map(o => [`${o.personId}:${o.month}`, o.monthlyHours]))
  // A bare YYYY-MM start means the 1st; a bare YYYY-MM end means the month's last day.
  const startDay = (s: string | null) => !s ? null : s.length === 7 ? `${s}-01` : s.slice(0, 10)
  const endDay = (s: string | null) => !s ? null : s.length === 7 ? `${s}-${daysInMonth(s)}` : s.slice(0, 10)
  const team = people.filter(p => includeExternal || !p.isExternal)
  return weeks.map(w => weekSum(w, (ym, day) => team.reduce((sum, p) => {
    const s = startDay(p.startDate), e = endDay(p.endDate)
    if ((s && day < s) || (e && day > e)) return sum
    return sum + (ov.get(`${p.id}:${ym}`) ?? p.billableHours)
  }, 0)))
}

/** Weekly hours a typical full-time delivery person adds — used to size a hire. */
export function fteWeeklyHours(people: CapacityPerson[]): number {
  const ft = people.filter(p => !p.isExternal && p.isFullTime && p.billableHours > 0)
  const monthly = ft.length ? ft.reduce((s, p) => s + p.billableHours, 0) / ft.length : 130
  return (monthly * 12) / 52
}

/** First index where `load[i] > cap[i]` (with a small tolerance), or -1. */
export function firstOver(load: number[], cap: number[]): number {
  return load.findIndex((h, i) => h > cap[i] + 0.05)
}
