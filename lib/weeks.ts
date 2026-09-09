// Week math for the weekly tracker.
//
// Weeks run Sunday–Saturday and are never split across a month boundary — the
// week of Mar 29–Apr 4 is one row, not two. A week belongs to the month its
// Sunday falls in, so every week appears exactly once in the year and each
// month holds four or five of them.
//
// The consequence, stated plainly: a month's weekly totals are not the calendar
// month. "March" here runs Mar 1 through Apr 4. That is deliberate — this
// tracks activity cadence, not the books, and MonthlyMetric remains the
// authority on calendar-month figures.
//
// Only the Sunday is ever stored. Everything below is derived, so changing the
// grouping rule later is a change to this file and nothing else.

/** A stored week: the Sunday that starts it, as YYYY-MM-DD. */
export type WeekStart = string

const DAY = 86400000

function utc(ymd: string): Date {
  return new Date(`${ymd}T00:00:00Z`)
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** The Sunday starting the week that contains `date` (a Date or YYYY-MM-DD). */
export function weekStartOf(date: Date | string): WeekStart {
  const d = typeof date === "string" ? utc(date) : utc(date.toISOString().slice(0, 10))
  return ymd(new Date(d.getTime() - d.getUTCDay() * DAY))
}

/** Shift a week start by `n` weeks. */
export function weekAdd(week: WeekStart, n: number): WeekStart {
  return ymd(new Date(utc(week).getTime() + n * 7 * DAY))
}

/** The Saturday ending the week. */
export function weekEndOf(week: WeekStart): string {
  return ymd(new Date(utc(week).getTime() + 6 * DAY))
}

/** YYYY-MM the week is filed under — the month containing its Sunday. */
export function monthOfWeek(week: WeekStart): string {
  return week.slice(0, 7)
}

/** Every week filed under `ym` (YYYY-MM), in order. Always four or five. */
export function weeksInMonth(ym: string): WeekStart[] {
  const first = weekStartOf(`${ym}-01`)
  // The first Sunday on or after the 1st is this month's week 1; a week that
  // started in the prior month belongs to that month, not this one.
  let w = monthOfWeek(first) === ym ? first : weekAdd(first, 1)
  const out: WeekStart[] = []
  while (monthOfWeek(w) === ym) {
    out.push(w)
    w = weekAdd(w, 1)
  }
  return out
}

/** Every week of a calendar year, in order. */
export function weeksInYear(year: number): WeekStart[] {
  const out: WeekStart[] = []
  for (let m = 1; m <= 12; m++) out.push(...weeksInMonth(`${year}-${String(m).padStart(2, "0")}`))
  return out
}

/** 1-based position of the week within its month. */
export function weekNumberInMonth(week: WeekStart): number {
  return weeksInMonth(monthOfWeek(week)).indexOf(week) + 1
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** "Mar 1–7", or "Mar 29 – Apr 4" when the week crosses a month. */
export function weekRangeLabel(week: WeekStart): string {
  const s = utc(week), e = utc(weekEndOf(week))
  const sm = MON[s.getUTCMonth()], em = MON[e.getUTCMonth()]
  return sm === em
    ? `${sm} ${s.getUTCDate()}–${e.getUTCDate()}`
    : `${sm} ${s.getUTCDate()} – ${em} ${e.getUTCDate()}`
}

/** "2026-Q1" for a YYYY-MM. */
export function quarterOfMonth(ym: string): string {
  const m = parseInt(ym.slice(5, 7), 10)
  return `${ym.slice(0, 4)}-Q${Math.floor((m - 1) / 3) + 1}`
}

/** "Q1 2026" */
export function quarterLabel(q: string): string {
  return `${q.slice(5)} ${q.slice(0, 4)}`
}

/** The week containing today. */
export function currentWeek(): WeekStart {
  return weekStartOf(new Date())
}

const MONTH_INDEX: Record<string, number> = {}
for (let i = 0; i < 12; i++) MONTH_INDEX[MON[i].toLowerCase()] = i
const MONTH_FULL = ["january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december"]
for (let i = 0; i < 12; i++) MONTH_INDEX[MONTH_FULL[i]] = i

/**
 * Read the leading date out of a spreadsheet's week cell and snap it to that
 * week's Sunday. Handles the shapes a pasted tracker actually contains:
 * "2026-03-29", "3/29/2026", "Mar 29", "Mar 22-28", "Mar 30 - Apr 4".
 *
 * `year` supplies what the label omits — sheet rows are usually just "Mar 29".
 * Returns null for anything without a day number, which is how subtotal rows
 * ("January", "Q1 total") and blank lines fall out of an import.
 */
export function parseWeekCell(raw: string, year: number): WeekStart | null {
  const s = raw.trim()
  if (!s) return null

  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return weekStartOf(`${iso[1]}-${iso[2]}-${iso[3]}`)

  const slash = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/)
  if (slash) {
    const m = +slash[1], d = +slash[2]
    let y = slash[3] ? +slash[3] : year
    if (y < 100) y += 2000
    if (m < 1 || m > 12 || d < 1 || d > 31) return null
    return weekStartOf(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`)
  }

  // "Mar 29", "March 29 - Apr 4" — first month/day pair wins.
  const named = s.match(/([A-Za-z]{3,9})\.?\s+(\d{1,2})/)
  if (named) {
    const mi = MONTH_INDEX[named[1].toLowerCase()]
    if (mi === undefined) return null
    const d = +named[2]
    if (d < 1 || d > 31) return null
    return weekStartOf(`${year}-${String(mi + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`)
  }

  return null
}
