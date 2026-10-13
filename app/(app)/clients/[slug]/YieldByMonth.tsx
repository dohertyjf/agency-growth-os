"use client"
import { Fragment, useState } from "react"
import Link from "next/link"
import { useFmtCurrency } from "@/lib/CurrencyContext"
import { ymLabel } from "@/lib/calc"

interface Contract {
  id: string
  name: string
  monthly: number
  hoursPerMonth?: number
  start: string
  contractedThrough: string | null
  status: string
  type: string
  accountId?: string | null
  deliveryStart?: string | null
  deliveryEnd?: string | null
}
interface Account { id: string; name: string }
interface AccountMonth { contractId: string; month: string; actual: number }
interface HoursRow { contractId: string; month: string; hours: number }

const now = new Date().toISOString().slice(0, 7)

function ymAdd(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number)
  const t = y * 12 + (m - 1) + n
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`
}
function ymSpan(a: string, b: string): string[] {
  const out: string[] = []
  const [ay, am] = a.split("-").map(Number)
  const [by, bm] = b.split("-").map(Number)
  for (let t = ay * 12 + am - 1; t <= by * 12 + bm - 1; t++) {
    out.push(`${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`)
  }
  return out
}
// Was this project actually being delivered in this month? Retainers run for their
// contracted term. One-offs run for their delivery window, which is decoupled from when
// the money lands — so a one-off paid in Aug but delivered in Jun belongs to Jun. Falls
// back to the contracted term, then to a single month, matching how one-offs are ended
// in the client page's auto-finish rule.
function activeInMonth(c: Contract, ym: string) {
  if (c.type === "oneoff") {
    const dStart = c.deliveryStart || c.start
    const dEnd = c.deliveryEnd || c.contractedThrough || dStart
    return dStart <= ym && ym <= dEnd
  }
  return c.start <= ym && (c.contractedThrough === null || c.contractedThrough >= ym)
}

export default function YieldByMonth({ contracts, accounts, accountMonths, initialHours, deliveryMonths, minHourlyRate, memberHours = [], clientSlug }: {
  contracts: Contract[]
  accounts: Account[]
  accountMonths: AccountMonth[]
  initialHours: HoursRow[]
  deliveryMonths: HoursRow[]
  minHourlyRate: number | null
  // Per-person hours from the project pages. Once a project-month has these, the
  // total here is derived from them and can only be changed there.
  memberHours?: { contractId: string; month: string; hours: number }[]
  clientSlug?: string
}) {
  const fmt$ = useFmtCurrency()
  const fromTeam = (contractId: string, m: string) => memberHours.some(h => h.contractId === contractId && h.month === m && h.hours > 0)
  const teamLink = (contractId: string, hours: number | null) => (
    <Link href={clientSlug ? `/clients/${clientSlug}/projects/${contractId}` : "#"} title="Logged per person on the project page — edit it there"
      style={{ display: "inline-block", border: "1px solid #ECE7DE", background: "#FBFAF7", borderRadius: 6, padding: "4px 9px", fontSize: 13, color: "#1A1916", textDecoration: "none", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
      {hours != null ? `${hours}h` : "—"} <span style={{ fontSize: 10, color: "#9C9590" }}>team ↗</span>
    </Link>
  )
  const [hours, setHours] = useState(() => {
    const m = new Map<string, number>()
    initialHours.forEach(h => m.set(`${h.contractId}:${h.month}`, h.hours))
    return m
  })
  // Hours get logged as the month goes, not only once it's closed, so the current month is
  // selectable and is where we open. Its yield is live and will move as more hours land.
  const [month, setMonth] = useState(now)
  const [editing, setEditing] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null)
  // One-off rows expand to reveal a per-month hours input for each delivery month.
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editingCell, setEditingCell] = useState<string | null>(null)

  const hasMin = minHourlyRate != null && minHourlyRate > 0

  // Yield measures work actually delivered, so speculative pipeline (Qualified /
  // Opportunity) and lost deals are excluded — only signed work has real hours to log.
  const delivered = contracts.filter(c => c.status === "active" || c.status === "finished")
  // Retainers bill by the month, so they belong in the month grid. One-offs are priced per
  // project and roll up separately below.
  const retainers = delivered.filter(c => c.type !== "oneoff")
  const oneoffs = delivered.filter(c => c.type === "oneoff")

  // Month options: earliest contract start → the current month.
  const starts = delivered.map(c => c.start).filter(Boolean)
  const earliest = starts.length ? starts.reduce((a, b) => (a < b ? a : b)) : now
  const monthOptions: string[] = []
  for (let m = earliest < now ? earliest : now; m <= now; m = ymAdd(m, 1)) monthOptions.push(m)
  const months = monthOptions.reverse()

  // Sold (budget) hours = the hours entered on the project — per month for retainers, the
  // whole block for one-offs. A project with none entered falls back to what its money
  // affords at the minimum yield, flagged as an estimate.
  function soldHours(c: Contract, money: number): { sold: number | null; soldEst: boolean } {
    if ((c.hoursPerMonth ?? 0) > 0) return { sold: c.hoursPerMonth as number, soldEst: false }
    if (hasMin) return { sold: money / (minHourlyRate as number), soldEst: true }
    return { sold: null, soldEst: false }
  }

  // Planned delivery hours per project per month — the schedule set in the project's
  // Payment & hours schedule (the same rows the Capacity view reads). Read-only here.
  const plannedByContract = new Map<string, Map<string, number>>()
  for (const d of deliveryMonths) {
    if (!plannedByContract.has(d.contractId)) plannedByContract.set(d.contractId, new Map())
    plannedByContract.get(d.contractId)!.set(d.month, d.hours)
  }

  const rows = retainers
    .filter(c => activeInMonth(c, month))
    .map(c => {
      const accountName = c.accountId ? accounts.find(a => a.id === c.accountId)?.name ?? null : null
      const am = accountMonths.find(a => a.contractId === c.id && a.month === month)
      const money = am ? am.actual : c.monthly
      const { sold, soldEst } = soldHours(c, money)
      // A retainer's plan is its scheduled hours for the month, else its hours per month.
      const planned = plannedByContract.get(c.id)?.get(month) ?? ((c.hoursPerMonth ?? 0) > 0 ? (c.hoursPerMonth as number) : null)
      const actual = hours.get(`${c.id}:${month}`) ?? null
      // Yield needs actual hours logged — no meaningful fallback.
      const perHr = actual != null && actual > 0 ? money / actual : null
      const overBudget = sold != null && actual != null && actual > sold
      return { c, accountName, money, planned, sold, soldEst, actual, perHr, overBudget }
    })

  type Row = (typeof rows)[number]
  const sortVal = (r: Row, key: string): number | string | null => {
    switch (key) {
      case "project": return r.c.name
      case "client": return r.accountName
      case "money": return r.money
      case "planned": return r.planned
      case "sold": return r.sold
      case "actual": return r.actual
      case "perHr": return r.perHr
      default: return null
    }
  }
  // Default (no column chosen): lowest yield first, to surface under-performers.
  const sortedRows = sort
    ? [...rows].sort((a, b) => {
        const av = sortVal(a, sort.key), bv = sortVal(b, sort.key)
        if (av == null && bv == null) return 0
        if (av == null) return 1  // blanks always last
        if (bv == null) return -1
        const d = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number)
        return sort.dir === "desc" ? -d : d
      })
    : [...rows].sort((a, b) => (a.perHr ?? Infinity) - (b.perHr ?? Infinity))

  // First click on a column sorts largest→smallest; click again flips it.
  function clickHeader(key: string) {
    setSort(prev => (prev?.key === key ? { key, dir: prev.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }))
  }

  const underMin = hasMin ? rows.filter(r => r.perHr != null && r.perHr < (minHourlyRate as number)).length : 0
  const r1 = (n: number) => Math.round(n * 10) / 10

  // Which months a one-off is delivered in. Explicit per-month delivery rows win when they
  // exist — they're the finer truth, and capacityByMonth already reads them that way.
  // Otherwise fall back to the delivery date window.
  function deliveryWindow(c: Contract): string[] {
    const explicit = [...(plannedByContract.get(c.id)?.keys() ?? [])]
    if (explicit.length) return explicit.sort()
    const dStart = c.deliveryStart || c.start
    const dEnd = c.deliveryEnd || c.contractedThrough || dStart
    return dEnd >= dStart ? ymSpan(dStart, dEnd) : [dStart]
  }
  // Any month with hours already logged is always included, so shrinking a window can
  // never hide logged work.
  function oneoffMonths(c: Contract): string[] {
    const logged = [...hours.keys()]
      .filter(k => k.startsWith(`${c.id}:`))
      .map(k => k.slice(c.id.length + 1))
    return [...new Set([...deliveryWindow(c), ...logged])].sort()
  }
  // Spreads a one-off's sold hours over its delivery months so over-delivery shows up in
  // the month it happens, not only once the whole budget is blown. Weighted by planned
  // hours where they're set, otherwise even across the window. Months outside the plan get
  // no budget, so every hour logged there counts as over.
  function monthlyBudget(c: Contract, sold: number): Map<string, number> {
    const planned = plannedByContract.get(c.id)
    const plannedTotal = planned ? [...planned.values()].reduce((s, h) => s + h, 0) : 0
    if (planned && plannedTotal > 0) return new Map([...planned].map(([m, h]) => [m, (sold * h) / plannedTotal]))
    const win = deliveryWindow(c)
    return new Map(win.map(m => [m, sold / win.length]))
  }

  // A one-off is sold as one fee for one piece of work, so its yield is the whole fee over
  // every hour delivery took — summed across its months. Splitting a fixed fee per month
  // would invent a rate that doesn't correspond to anything real. (Hours are different:
  // the plan already puts them in months, so the hour budget can follow it.)
  const oneoffRows = oneoffs.map(c => {
    const accountName = c.accountId ? accounts.find(a => a.id === c.accountId)?.name ?? null : null
    const money = c.monthly  // one-offs store the whole project price here, not a monthly rate
    const { sold, soldEst } = soldHours(c, money)
    const budget = sold != null ? monthlyBudget(c, sold) : null
    const perMonth = oneoffMonths(c).map(m => ({
      month: m,
      hours: hours.get(`${c.id}:${m}`) ?? null,
      // No schedule entered means nothing planned — shown as a dash, not invented.
      planned: plannedByContract.get(c.id)?.get(m) ?? null,
      budget: budget ? budget.get(m) ?? 0 : null,
    }))
    const anyLogged = perMonth.some(pm => pm.hours != null)
    const actual = anyLogged ? perMonth.reduce((sum, pm) => sum + (pm.hours ?? 0), 0) : null
    const perHr = actual != null && actual > 0 ? money / actual : null
    const overBudget = sold != null && actual != null && actual > sold
    // Early warning: the delivery plan already calls for more hours than were sold.
    const plannedTotal = [...(plannedByContract.get(c.id)?.values() ?? [])].reduce((s, h) => s + h, 0)
    const overPlanned = sold != null && plannedTotal > sold + 0.05
    return { c, accountName, perMonth, money, plannedTotal, sold, soldEst, actual, perHr, overBudget, overPlanned }
  })
    // The month picker chooses *which* one-offs are on screen — those being delivered in
    // it — while the figures stay whole-project. Scoping the list (not the money) is what
    // keeps the picker meaningful without re-introducing the per-month fee split.
    .filter(r => r.perMonth.some(pm => pm.month === month))
  // Same default as the monthly table: worst yield first, unlogged last.
  const sortedOneoffs = [...oneoffRows].sort((a, b) => (a.perHr ?? Infinity) - (b.perHr ?? Infinity))

  // Month totals across retainers and one-offs. Budget is every project's budget for the
  // month; worked is whatever's logged so far, so the current month moves as hours land.
  // Over-delivery is per project (delivered > budget) — under-delivery elsewhere doesn't
  // cancel it out.
  function tally(items: { planned: number | null; worked: number | null; budget: number | null }[]) {
    let planned = 0, worked = 0, budget = 0, over = 0
    for (const { planned: p, worked: w, budget: b } of items) {
      if (p != null) planned += p
      if (w != null) worked += w
      if (b != null) budget += b
      if (w != null && b != null) over += Math.max(0, w - b)
    }
    return { planned, worked, budget, over }
  }
  const retainerTotals = tally(rows.map(r => ({ planned: r.planned, worked: r.actual, budget: r.sold })))
  const oneoffTotals = tally(oneoffRows.map(r => {
    const pm = r.perMonth.find(p => p.month === month)
    return { planned: pm?.planned ?? null, worked: pm?.hours ?? null, budget: pm?.budget ?? null }
  }))
  const totals = {
    planned: retainerTotals.planned + oneoffTotals.planned,
    worked: retainerTotals.worked + oneoffTotals.worked,
    budget: retainerTotals.budget + oneoffTotals.budget,
    over: retainerTotals.over + oneoffTotals.over,
  }
  const recoverable = hasMin ? totals.over * (minHourlyRate as number) : 0
  const overPlannedCount = oneoffRows.filter(r => r.overPlanned).length
  const anyEstimated = rows.some(r => r.soldEst) || oneoffRows.some(r => r.soldEst)

  async function saveHours(contractId: string, m: string, raw: string) {
    const v = parseFloat(raw)
    if (isNaN(v) || v < 0) return
    const key = `${contractId}:${m}`
    const current = hours.get(key) ?? null
    if ((v || null) === (current ?? null)) return
    setHours(prev => {
      const n = new Map(prev)
      if (v > 0) n.set(key, v); else n.delete(key)
      return n
    })
    setSavedId(contractId)
    setTimeout(() => setSavedId(s => (s === contractId ? null : s)), 1500)
    const res = await fetch(`/api/contracts/${contractId}/hours`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: m, hours: v }),
    })
    // Rejected (e.g. no access) — put the old value back rather than show a number that didn't save.
    if (!res.ok) {
      setSavedId(null)
      setHours(prev => {
        const n = new Map(prev)
        if (current != null) n.set(key, current); else n.delete(key)
        return n
      })
    }
  }

  // Planned and Budget come from the Projects tab — shown greyed, not editable here.
  const readOnly: React.CSSProperties = { padding: "8px 10px", fontSize: 13, color: "#9C9590", fontStyle: "italic", textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }
  const soldCell = (sold: number | null, est: boolean) =>
    sold == null ? "—" : <span title={est ? "No hours entered on this project — estimated from your minimum hourly yield" : undefined}>{r1(sold)}h{est && <span style={{ fontSize: 9, marginLeft: 3 }}>est.</span>}</span>

  function perHrColor(v: number | null) {
    if (v == null) return "#C4BFB8"
    return hasMin ? (v >= (minHourlyRate as number) ? "#1F7A4D" : "#C2410C") : "#1A1916"
  }

  const th: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "#9C9590", padding: "6px 10px", borderBottom: "1px solid #ECE7DE", whiteSpace: "nowrap" }

  return (
    <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1916" }}>Hourly yield by project</div>
          <div style={{ fontSize: 11, color: "#9C9590", marginTop: 2 }}>
            {hasMin
              ? <>Sold hrs = hours entered on each project · log actual hrs to see real $/hr{underMin > 0 && <> · <strong style={{ color: "#C2410C" }}>{underMin} under</strong></>}</>
              : <>Sold hrs = hours entered on each project · set a <strong>Minimum Hourly Yield</strong> in Settings to flag under-performers</>}
          </div>
        </div>
        <select value={month} onChange={e => setMonth(e.target.value)}
          style={{ padding: "6px 10px", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 13, background: "#fff", color: "#1A1916", fontFamily: "inherit", cursor: "pointer" }}>
          {months.map(m => <option key={m} value={m}>{ymLabel(m)}{m === now ? " (current)" : ""}</option>)}
        </select>
      </div>

      {rows.length === 0 ? (
        <div style={{ fontSize: 13, color: "#9C9590", padding: "16px 0" }}>No retainers active in {ymLabel(month)}.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 560 }}>
            <thead>
              <tr>
                {([["Project", "project", "left"], ["Client", "client", "left"], ["Money", "money", "right"], ["Planned", "planned", "right"], ["Budget", "sold", "right"], ["Worked", "actual", "right"], ["$ / hr", "perHr", "right"]] as const).map(([label, key, align]) => (
                  <th key={key} onClick={() => clickHeader(key)}
                    style={{ ...th, textAlign: align, cursor: "pointer", userSelect: "none", color: sort?.key === key ? "#1A1916" : "#9C9590" }}>
                    {label}{sort?.key === key ? (sort.dir === "desc" ? " ↓" : " ↑") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map(({ c, accountName, money, planned, sold, soldEst, actual, perHr, overBudget }) => (
                <tr key={c.id} style={{ borderBottom: "1px solid #F5F1EC" }}>
                  <td style={{ padding: "8px 10px", fontSize: 13, color: "#1A1916", fontWeight: 500, whiteSpace: "nowrap" }}>{c.name}</td>
                  <td style={{ padding: "8px 10px", fontSize: 12, color: accountName ? "#6B6760" : "#C2410C", whiteSpace: "nowrap" }}>{accountName ?? "Unassigned"}</td>
                  <td style={{ padding: "8px 10px", fontSize: 13, color: "#1A1916", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt$(money)}</td>
                  <td style={{ ...readOnly }} title="From the project's hours schedule — edit it on the Projects tab">{planned != null ? `${r1(planned)}h` : "—"}</td>
                  <td style={{ ...readOnly }} title="Hours sold on the project — edit it on the Projects tab">{soldCell(sold, soldEst)}</td>
                  <td style={{ padding: "4px 10px", textAlign: "right" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 5, justifyContent: "flex-end" }}>
                      {fromTeam(c.id, month) ? teamLink(c.id, actual) : editing === c.id ? (
                        <input
                          autoFocus type="number" min={0} step={0.5} defaultValue={actual ?? ""}
                          onBlur={e => { setEditing(null); saveHours(c.id, month, e.target.value) }}
                          onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditing(null) }}
                          style={{ width: 60, padding: "5px 8px", border: "1px solid #E9532A", borderRadius: 6, fontSize: 13, textAlign: "right", fontVariantNumeric: "tabular-nums", outline: "none", background: "#FFF7ED", fontFamily: "inherit" }}
                        />
                      ) : (
                        <button onClick={() => setEditing(c.id)} title="Click to log"
                          style={{ background: "none", border: "1px dashed #E0DAD0", borderRadius: 6, padding: "4px 9px", fontSize: 13, fontWeight: overBudget ? 700 : 400, color: actual != null ? (overBudget ? "#C2410C" : "#1A1916") : "#C4BFB8", cursor: "pointer", fontVariantNumeric: "tabular-nums" }}>
                          {actual != null ? `${actual}h` : "log"}
                        </button>
                      )}
                      <span style={{ color: "#1F7A4D", fontSize: 13, fontWeight: 700, width: 10, opacity: savedId === c.id ? 1 : 0, transition: "opacity 0.2s" }}>✓</span>
                    </div>
                  </td>
                  <td style={{ padding: "8px 10px", fontSize: 14, fontWeight: 700, textAlign: "right", fontVariantNumeric: "tabular-nums", color: perHrColor(perHr) }}>
                    {perHr != null ? (
                      <>{hasMin && <span style={{ fontSize: 10 }}>{perHr >= (minHourlyRate as number) ? "▲" : "▼"} </span>}{fmt$(perHr)}</>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 10, color: "#B0A9A0", marginTop: 8 }}>Planned = the project's hours schedule; Budget = hours sold. Both are set on the Projects tab. Worked over budget shows red. Click a column to sort (default: lowest yield first).</div>
        </div>
      )}

      {oneoffRows.length > 0 && (
        <div style={{ marginTop: 24, borderTop: "1px solid #ECE7DE", paddingTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1916" }}>One-off projects delivering in {ymLabel(month)}</div>
          <div style={{ fontSize: 11, color: "#9C9590", marginTop: 2, marginBottom: 10 }}>
            Priced per project, so the figures below are for the whole project, not this month alone. Click one to log hours against each of its delivery months.
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 560 }}>
              <thead>
                <tr>
                  {(["Project", "Client", "Money", "Planned", "Sold hrs", "Worked", "$ / hr"] as const).map((label, i) => (
                    <th key={label} style={{ ...th, textAlign: i < 2 ? "left" : "right" }}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedOneoffs.map(({ c, accountName, perMonth, money, plannedTotal, sold, soldEst, actual, perHr, overBudget, overPlanned }) => (
                  <Fragment key={c.id}>
                    <tr onClick={() => setExpanded(e => (e === c.id ? null : c.id))}
                      style={{ borderBottom: "1px solid #F5F1EC", cursor: "pointer" }}>
                      <td style={{ padding: "8px 10px", fontSize: 13, color: "#1A1916", fontWeight: 500, whiteSpace: "nowrap" }}>
                        <span style={{ color: "#C4BFB8", marginRight: 5 }}>{expanded === c.id ? "▾" : "▸"}</span>{c.name}
                      </td>
                      <td style={{ padding: "8px 10px", fontSize: 12, color: accountName ? "#6B6760" : "#C2410C", whiteSpace: "nowrap" }}>{accountName ?? "Unassigned"}</td>
                      <td style={{ padding: "8px 10px", fontSize: 13, color: "#1A1916", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt$(money)}</td>
                      <td style={{ ...readOnly, ...(overPlanned ? { color: "#B45309", fontWeight: 700, fontStyle: "normal" } : {}) }}
                        title={overPlanned ? "The delivery plan calls for more hours than were sold" : "Whole-project hours schedule — edit it on the Projects tab"}>
                        {plannedTotal > 0 ? <>{overPlanned && "⚠ "}{r1(plannedTotal)}h{overPlanned && sold != null && <span style={{ fontSize: 10 }}> (+{r1(plannedTotal - sold)}h)</span>}</> : "—"}
                      </td>
                      <td style={{ ...readOnly }}>{soldCell(sold, soldEst)}</td>
                      <td style={{ padding: "8px 10px", fontSize: 13, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: overBudget ? 700 : 400, color: actual != null ? (overBudget ? "#C2410C" : "#1A1916") : "#C4BFB8" }}>
                        {actual != null ? `${r1(actual)}h` : "—"}
                      </td>
                      <td style={{ padding: "8px 10px", fontSize: 14, fontWeight: 700, textAlign: "right", fontVariantNumeric: "tabular-nums", color: perHrColor(perHr) }}>
                        {perHr != null ? (
                          <>{hasMin && <span style={{ fontSize: 10 }}>{perHr >= (minHourlyRate as number) ? "▲" : "▼"} </span>}{fmt$(perHr)}</>
                        ) : "—"}
                      </td>
                    </tr>
                    {expanded === c.id && (
                      <tr style={{ borderBottom: "1px solid #F5F1EC" }}>
                        <td colSpan={7} style={{ padding: 0 }}>
                          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", padding: "10px 10px 12px 26px", background: "#FBFAF7" }}>
                            {perMonth.map(pm => (
                              <div key={pm.month}>
                                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9C9590", marginBottom: 3 }}>{ymLabel(pm.month)}</div>
                                {pm.month > now ? (
                                  <div title="Hours can only be logged for the current month or earlier" style={{ width: 62, padding: "4px 9px", fontSize: 13, color: "#D6D0C8", textAlign: "center" }}>—</div>
                                ) : fromTeam(c.id, pm.month) ? teamLink(c.id, pm.hours) : editingCell === `${c.id}:${pm.month}` ? (
                                  <input
                                    autoFocus type="number" min={0} step={0.5} defaultValue={pm.hours ?? ""}
                                    onBlur={e => { setEditingCell(null); saveHours(c.id, pm.month, e.target.value) }}
                                    onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditingCell(null) }}
                                    style={{ width: 62, padding: "5px 8px", border: "1px solid #E9532A", borderRadius: 6, fontSize: 13, textAlign: "right", fontVariantNumeric: "tabular-nums", outline: "none", background: "#FFF7ED", fontFamily: "inherit" }}
                                  />
                                ) : (
                                  <button onClick={() => setEditingCell(`${c.id}:${pm.month}`)} title="Click to log"
                                    style={{ width: 62, background: "none", border: "1px dashed #E0DAD0", borderRadius: 6, padding: "4px 9px", fontSize: 13, fontWeight: pm.budget != null && pm.hours != null && pm.hours > pm.budget ? 700 : 400, color: pm.hours != null ? (pm.budget != null && pm.hours > pm.budget ? "#C2410C" : "#1A1916") : "#C4BFB8", cursor: "pointer", fontVariantNumeric: "tabular-nums" }}>
                                    {pm.hours != null ? `${pm.hours}h` : "log"}
                                  </button>
                                )}
                                <div style={{ fontSize: 10, color: "#9C9590", marginTop: 3, fontVariantNumeric: "tabular-nums", lineHeight: 1.4 }}>
                                  <div>plan {pm.planned != null ? `${r1(pm.planned)}h` : "—"}</div>
                                  {pm.budget != null && <div>budget {r1(pm.budget)}h</div>}
                                </div>
                              </div>
                            ))}
                            <span style={{ color: "#1F7A4D", fontSize: 13, fontWeight: 700, marginLeft: 4, opacity: savedId === c.id ? 1 : 0, transition: "opacity 0.2s" }}>✓ saved</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
            <div style={{ fontSize: 10, color: "#B0A9A0", marginTop: 8 }}>Money is the whole project fee. Actual hrs sums every month logged above, so $/hr is the rate for the project end to end. Each month's hour budget is the sold hours spread over the delivery plan.</div>
          </div>
        </div>
      )}

      {(rows.length > 0 || oneoffRows.length > 0) && (
        <div style={{ marginTop: 24, borderTop: "1px solid #ECE7DE", paddingTop: 16, display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ overflowX: "auto" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1916", marginBottom: 6 }}>{ymLabel(month)} totals{month === now && <span style={{ fontSize: 11, fontWeight: 400, color: "#9C9590" }}> · live, updates as hours are logged</span>}</div>
            <table style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {(["", "Planned", "Budget", "Worked", "vs plan", "Over-delivered"] as const).map((label, i) => (
                    <th key={label || "kind"} style={{ ...th, textAlign: i === 0 ? "left" : "right" }}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {([
                  ...(rows.length > 0 ? [["Retainers", retainerTotals] as const] : []),
                  ...(oneoffRows.length > 0 ? [["One-offs", oneoffTotals] as const] : []),
                  ["Total", totals] as const,
                ]).map(([label, t]) => {
                  const isTotal = label === "Total"
                  const cell: React.CSSProperties = { padding: "6px 10px", fontSize: isTotal ? 15 : 13, fontWeight: isTotal ? 700 : 500, textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", borderTop: isTotal ? "1px solid #ECE7DE" : undefined }
                  return (
                    <tr key={label}>
                      <td style={{ ...cell, textAlign: "left", color: isTotal ? "#1A1916" : "#6B6760" }}>{label}</td>
                      <td style={{ ...cell, color: "#9C9590" }}>{t.planned > 0 ? `${r1(t.planned)}h` : "—"}</td>
                      <td style={{ ...cell, color: "#9C9590" }}>{r1(t.budget)}h</td>
                      <td style={{ ...cell, color: "#1A1916" }}>{r1(t.worked)}h</td>
                      <td style={{ ...cell, color: t.planned > 0 && t.worked > t.planned ? "#B45309" : "#6B6760" }}>
                        {t.planned > 0 ? `${t.worked - t.planned > 0 ? "+" : ""}${r1(t.worked - t.planned)}h` : "—"}
                      </td>
                      <td style={{ ...cell, color: t.over > 0 ? "#C2410C" : "#1F7A4D" }}>{t.over > 0 ? "+" : ""}{r1(t.over)}h</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div style={{ fontSize: 10, color: "#B0A9A0", marginTop: 6, maxWidth: 420 }}>
              vs plan = worked minus planned{month === now && " (so far this month)"}. Over-delivered = hours past each project's budget, added up — one project running under doesn't offset another running over.
              {anyEstimated && hasMin && <> Projects with no hours entered are budgeted at {fmt$(minHourlyRate as number)}/hr (marked est.).</>}
            </div>
            {overPlannedCount > 0 && (
              <div style={{ fontSize: 11, fontWeight: 600, color: "#B45309", marginTop: 6 }}>
                ⚠ {overPlannedCount} one-off{overPlannedCount === 1 ? " is" : "s are"} planned for more hours than sold
              </div>
            )}
          </div>
          {hasMin && (
            <div style={{ marginLeft: "auto", textAlign: "right", background: "#FBF0EB", border: "1px solid #F3D3C6", borderRadius: 10, padding: "10px 16px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9C5A3C" }}>Could bill if reined in</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: "#E9532A", fontVariantNumeric: "tabular-nums", marginTop: 2 }}>{fmt$(recoverable)}</div>
              <div style={{ fontSize: 10, color: "#B0857A", marginTop: 2 }}>
                {totals.over > 0
                  ? `${r1(totals.over)} unpaid hrs × ${fmt$(minHourlyRate as number)}/hr`
                  : "no over-delivery this month — nice"}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
