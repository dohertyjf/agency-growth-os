"use client"
import { Fragment, useState } from "react"
import { useFmtCurrency } from "@/lib/CurrencyContext"

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
function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number)
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  return `${names[m - 1]} '${String(y).slice(2)}`
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

export default function YieldByMonth({ contracts, accounts, accountMonths, initialHours, deliveryMonths, minHourlyRate }: {
  contracts: Contract[]
  accounts: Account[]
  accountMonths: AccountMonth[]
  initialHours: HoursRow[]
  deliveryMonths: HoursRow[]
  minHourlyRate: number | null
}) {
  const fmt$ = useFmtCurrency()
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

  const rows = retainers
    .filter(c => activeInMonth(c, month))
    .map(c => {
      const accountName = c.accountId ? accounts.find(a => a.id === c.accountId)?.name ?? null : null
      const am = accountMonths.find(a => a.contractId === c.id && a.month === month)
      const money = am ? am.actual : c.monthly
      // Sold (budget) hours = the hours this revenue affords at the minimum yield.
      const sold = hasMin && (minHourlyRate as number) > 0 ? money / (minHourlyRate as number) : null
      const actual = hours.get(`${c.id}:${month}`) ?? null
      // Yield needs actual hours logged — no meaningful fallback.
      const perHr = actual != null && actual > 0 ? money / actual : null
      const overBudget = sold != null && actual != null && actual > sold
      return { c, accountName, money, sold, actual, perHr, overBudget }
    })

  type Row = (typeof rows)[number]
  const sortVal = (r: Row, key: string): number | string | null => {
    switch (key) {
      case "project": return r.c.name
      case "client": return r.accountName
      case "money": return r.money
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

  // Over-delivery summary — only over projects with actual hours logged.
  const logged = rows.filter(r => r.actual != null && r.sold != null)
  const totalSold = logged.reduce((s, r) => s + (r.sold as number), 0)
  const totalWorked = logged.reduce((s, r) => s + (r.actual as number), 0)
  // Unpaid hours: sum of per-project overage where delivered > sold. Under-delivery ignored.
  const overHours = logged.reduce((s, r) => s + Math.max(0, (r.actual as number) - (r.sold as number)), 0)
  const recoverable = hasMin && overHours > 0 ? overHours * (minHourlyRate as number) : 0
  const r1 = (n: number) => Math.round(n * 10) / 10

  // Which months a one-off was actually delivered in. Explicit per-month delivery rows win
  // when they exist — they're the finer truth, and capacityByMonth already reads them that
  // way. Otherwise fall back to the delivery date window. Any month with hours already
  // logged is always included, so shrinking a window can never hide logged work.
  const deliveryByContract = new Map<string, string[]>()
  for (const d of deliveryMonths) {
    if (!deliveryByContract.has(d.contractId)) deliveryByContract.set(d.contractId, [])
    deliveryByContract.get(d.contractId)!.push(d.month)
  }
  function oneoffMonths(c: Contract): string[] {
    const explicit = deliveryByContract.get(c.id) ?? []
    const dStart = c.deliveryStart || c.start
    const dEnd = c.deliveryEnd || c.contractedThrough || dStart
    const window = dEnd >= dStart ? ymSpan(dStart, dEnd) : [dStart]
    const logged = [...hours.keys()]
      .filter(k => k.startsWith(`${c.id}:`))
      .map(k => k.slice(c.id.length + 1))
    return [...new Set([...(explicit.length ? explicit : window), ...logged])].sort()
  }

  // A one-off is sold as one fee for one piece of work, so its yield is the whole fee over
  // every hour delivery took — summed across its months. Splitting a fixed fee per month
  // would invent a rate that doesn't correspond to anything real.
  const oneoffRows = oneoffs.map(c => {
    const accountName = c.accountId ? accounts.find(a => a.id === c.accountId)?.name ?? null : null
    const ms = oneoffMonths(c)
    const perMonth = ms.map(m => ({ month: m, hours: hours.get(`${c.id}:${m}`) ?? null }))
    const anyLogged = perMonth.some(pm => pm.hours != null)
    const actual = anyLogged ? perMonth.reduce((sum, pm) => sum + (pm.hours ?? 0), 0) : null
    const money = c.monthly  // one-offs store the whole project price here, not a monthly rate
    const sold = hasMin && (minHourlyRate as number) > 0 ? money / (minHourlyRate as number) : null
    const perHr = actual != null && actual > 0 ? money / actual : null
    const overBudget = sold != null && actual != null && actual > sold
    return { c, accountName, perMonth, money, sold, actual, perHr, overBudget }
  })
    // The month picker chooses *which* one-offs are on screen — those being delivered in
    // it — while the figures stay whole-project. Scoping the list (not the money) is what
    // keeps the picker meaningful without re-introducing the per-month fee split.
    .filter(r => r.perMonth.some(pm => pm.month === month))
  // Same default as the monthly table: worst yield first, unlogged last.
  const sortedOneoffs = [...oneoffRows].sort((a, b) => (a.perHr ?? Infinity) - (b.perHr ?? Infinity))

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
    await fetch(`/api/contracts/${contractId}/hours`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: m, hours: v }),
    })
  }

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
              ? <>Sold hrs = budget at {fmt$(minHourlyRate as number)}/hr · log actual hrs to see real $/hr{underMin > 0 && <> · <strong style={{ color: "#C2410C" }}>{underMin} under</strong></>}</>
              : <>Set a <strong>Minimum Hourly Yield</strong> in Settings to budget hours and flag under-performers</>}
          </div>
        </div>
        <select value={month} onChange={e => setMonth(e.target.value)}
          style={{ padding: "6px 10px", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 13, background: "#fff", color: "#1A1916", fontFamily: "inherit", cursor: "pointer" }}>
          {months.map(m => <option key={m} value={m}>{monthLabel(m)}{m === now ? " (current)" : ""}</option>)}
        </select>
      </div>

      {rows.length === 0 ? (
        <div style={{ fontSize: 13, color: "#9C9590", padding: "16px 0" }}>No retainers active in {monthLabel(month)}.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 560 }}>
            <thead>
              <tr>
                {([["Project", "project", "left"], ["Client", "client", "left"], ["Money", "money", "right"], ["Sold hrs", "sold", "right"], ["Actual hrs", "actual", "right"], ["$ / hr", "perHr", "right"]] as const).map(([label, key, align]) => (
                  <th key={key} onClick={() => clickHeader(key)}
                    style={{ ...th, textAlign: align, cursor: "pointer", userSelect: "none", color: sort?.key === key ? "#1A1916" : "#9C9590" }}>
                    {label}{sort?.key === key ? (sort.dir === "desc" ? " ↓" : " ↑") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map(({ c, accountName, money, sold, actual, perHr, overBudget }) => (
                <tr key={c.id} style={{ borderBottom: "1px solid #F5F1EC" }}>
                  <td style={{ padding: "8px 10px", fontSize: 13, color: "#1A1916", fontWeight: 500, whiteSpace: "nowrap" }}>{c.name}</td>
                  <td style={{ padding: "8px 10px", fontSize: 12, color: accountName ? "#6B6760" : "#C2410C", whiteSpace: "nowrap" }}>{accountName ?? "Unassigned"}</td>
                  <td style={{ padding: "8px 10px", fontSize: 13, color: "#1A1916", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt$(money)}</td>
                  <td style={{ padding: "8px 10px", fontSize: 13, color: "#9C9590", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{sold != null ? `${Math.round(sold * 10) / 10}h` : "—"}</td>
                  <td style={{ padding: "4px 10px", textAlign: "right" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 5, justifyContent: "flex-end" }}>
                      {editing === c.id ? (
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
          <div style={{ fontSize: 10, color: "#B0A9A0", marginTop: 8 }}>Sold hrs = the hours this revenue affords at your minimum yield (set in Settings). Actual over budget shows red. Click a column to sort (default: lowest yield first).</div>

          {hasMin && logged.length > 0 && (
            <div style={{ marginTop: 16, borderTop: "1px solid #ECE7DE", paddingTop: 16, display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9C9590" }}>Hours sold (budget)</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#1A1916", fontVariantNumeric: "tabular-nums", marginTop: 3 }}>{r1(totalSold)}h</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9C9590" }}>Hours worked</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#1A1916", fontVariantNumeric: "tabular-nums", marginTop: 3 }}>{r1(totalWorked)}h</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9C9590" }}>Over-delivered hrs (unpaid)</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: overHours > 0 ? "#C2410C" : "#1F7A4D", fontVariantNumeric: "tabular-nums", marginTop: 3 }}>{overHours > 0 ? "+" : ""}{r1(overHours)}h</div>
              </div>
              <div style={{ marginLeft: "auto", textAlign: "right", background: "#FBF0EB", border: "1px solid #F3D3C6", borderRadius: 10, padding: "10px 16px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9C5A3C" }}>Could bill if reined in</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: "#E9532A", fontVariantNumeric: "tabular-nums", marginTop: 2 }}>{fmt$(recoverable)}</div>
                <div style={{ fontSize: 10, color: "#B0857A", marginTop: 2 }}>
                  {overHours > 0
                    ? `${r1(overHours)} unpaid hrs × ${fmt$(minHourlyRate as number)}/hr`
                    : "no over-delivery this month — nice"}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {oneoffRows.length > 0 && (
        <div style={{ marginTop: 24, borderTop: "1px solid #ECE7DE", paddingTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1916" }}>One-off projects delivering in {monthLabel(month)}</div>
          <div style={{ fontSize: 11, color: "#9C9590", marginTop: 2, marginBottom: 10 }}>
            Priced per project, so the figures below are for the whole project, not this month alone. Click one to log hours against each of its delivery months.
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 560 }}>
              <thead>
                <tr>
                  {(["Project", "Client", "Money", "Sold hrs", "Actual hrs", "$ / hr"] as const).map((label, i) => (
                    <th key={label} style={{ ...th, textAlign: i < 2 ? "left" : "right" }}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedOneoffs.map(({ c, accountName, perMonth, money, sold, actual, perHr, overBudget }) => (
                  <Fragment key={c.id}>
                    <tr onClick={() => setExpanded(e => (e === c.id ? null : c.id))}
                      style={{ borderBottom: "1px solid #F5F1EC", cursor: "pointer" }}>
                      <td style={{ padding: "8px 10px", fontSize: 13, color: "#1A1916", fontWeight: 500, whiteSpace: "nowrap" }}>
                        <span style={{ color: "#C4BFB8", marginRight: 5 }}>{expanded === c.id ? "▾" : "▸"}</span>{c.name}
                      </td>
                      <td style={{ padding: "8px 10px", fontSize: 12, color: accountName ? "#6B6760" : "#C2410C", whiteSpace: "nowrap" }}>{accountName ?? "Unassigned"}</td>
                      <td style={{ padding: "8px 10px", fontSize: 13, color: "#1A1916", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt$(money)}</td>
                      <td style={{ padding: "8px 10px", fontSize: 13, color: "#9C9590", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{sold != null ? `${r1(sold)}h` : "—"}</td>
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
                        <td colSpan={6} style={{ padding: 0 }}>
                          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", padding: "10px 10px 12px 26px", background: "#FBFAF7" }}>
                            {perMonth.map(pm => (
                              <div key={pm.month}>
                                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9C9590", marginBottom: 3 }}>{monthLabel(pm.month)}</div>
                                {editingCell === `${c.id}:${pm.month}` ? (
                                  <input
                                    autoFocus type="number" min={0} step={0.5} defaultValue={pm.hours ?? ""}
                                    onBlur={e => { setEditingCell(null); saveHours(c.id, pm.month, e.target.value) }}
                                    onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditingCell(null) }}
                                    style={{ width: 62, padding: "5px 8px", border: "1px solid #E9532A", borderRadius: 6, fontSize: 13, textAlign: "right", fontVariantNumeric: "tabular-nums", outline: "none", background: "#FFF7ED", fontFamily: "inherit" }}
                                  />
                                ) : (
                                  <button onClick={() => setEditingCell(`${c.id}:${pm.month}`)} title="Click to log"
                                    style={{ width: 62, background: "none", border: "1px dashed #E0DAD0", borderRadius: 6, padding: "4px 9px", fontSize: 13, color: pm.hours != null ? "#1A1916" : "#C4BFB8", cursor: "pointer", fontVariantNumeric: "tabular-nums" }}>
                                    {pm.hours != null ? `${pm.hours}h` : "log"}
                                  </button>
                                )}
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
            <div style={{ fontSize: 10, color: "#B0A9A0", marginTop: 8 }}>Money is the whole project fee. Actual hrs sums every month logged above, so $/hr is the rate for the project end to end.</div>
          </div>
        </div>
      )}
    </div>
  )
}
