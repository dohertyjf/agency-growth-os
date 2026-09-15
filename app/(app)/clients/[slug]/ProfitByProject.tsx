"use client"
import { Fragment, useMemo, useState } from "react"
import Link from "next/link"
import { ymLabel } from "@/lib/calc"
import { useFmtCurrency } from "@/lib/CurrencyContext"
import { activeInMonth, projectMonthPnl, projectLifetimePnl, sumPnl, ymAdd, type ProfitContract, type ProfitInputs, type MonthPnl } from "@/lib/profit"

interface Account { id: string; name: string }

const now = new Date().toISOString().slice(0, 7)

const th: React.CSSProperties = { textAlign: "right", fontSize: 11, fontWeight: 600, color: "#9C9590", padding: "6px 10px", borderBottom: "1px solid #ECE7DE", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" }
const td: React.CSSProperties = { padding: "9px 10px", fontSize: 13, textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", color: "#1A1916" }

function fmtHrs(h: number) { return `${Math.round(h * 10) / 10}h` }
function fmtPct(p: number | null) { return p == null ? "—" : `${Math.round(p)}%` }
function marginColor(p: number | null) { return p == null ? "#9C9590" : p < 0 ? "#B23A1B" : p < 30 ? "#B45309" : "#15803D" }

type SortKey = "project" | "account" | "revenue" | "hours" | "teamCost" | "directCost" | "margin" | "marginPct" | "perHr"

// Profit by project for one month (or project-to-date): the table the agency
// owner actually wants. Grouped under the account when it has more than one
// project, lowest margin first so the problems surface.
export default function ProfitByProject({ clientSlug, contracts, accounts, inputs, minHourlyRate }: {
  clientSlug: string
  contracts: ProfitContract[]
  accounts: Account[]
  inputs: ProfitInputs
  minHourlyRate: number | null
}) {
  const fmt = useFmtCurrency()
  const [month, setMonth] = useState(now)
  const [mode, setMode] = useState<"month" | "lifetime">("month")
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "marginPct", dir: "asc" })

  // Only signed work has real hours and costs; pipeline and lost deals are out.
  const delivered = contracts.filter(c => c.status === "active" || c.status === "finished")

  const starts = delivered.map(c => c.start).filter(Boolean)
  const earliest = starts.length ? starts.reduce((a, b) => (a < b ? a : b)) : now
  const monthOptions: string[] = []
  for (let m = earliest < now ? earliest : now; m <= now; m = ymAdd(m, 1)) monthOptions.push(m)
  monthOptions.reverse()

  const rows = useMemo(() => {
    const list = mode === "month" ? delivered.filter(c => activeInMonth(c, month, now)) : delivered
    return list.map(c => {
      const pnl: MonthPnl = mode === "month" ? projectMonthPnl(c, month, inputs, now) : projectLifetimePnl(c, inputs, now)
      const account = c.accountId ? accounts.find(a => a.id === c.accountId) ?? null : null
      return { c, account, pnl }
    })
  }, [delivered, mode, month, inputs, accounts])

  const val = (r: (typeof rows)[number], key: SortKey): number | string | null => {
    switch (key) {
      case "project": return r.c.name
      case "account": return r.account?.name ?? null
      case "revenue": return r.pnl.revenue
      case "hours": return r.pnl.hours
      case "teamCost": return r.pnl.teamCost
      case "directCost": return r.pnl.directCost
      case "margin": return r.pnl.margin
      case "marginPct": return r.pnl.marginPct
      case "perHr": return r.pnl.perHr
    }
  }
  const sorted = [...rows].sort((a, b) => {
    const av = val(a, sort.key), bv = val(b, sort.key)
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    const d = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number)
    return sort.dir === "desc" ? -d : d
  })

  // Group under the account only when it has more than one project in view.
  const groups: { account: Account | null; rows: typeof rows; subtotal: MonthPnl | null }[] = []
  const multi = new Set<string>()
  const counts = new Map<string, number>()
  for (const r of sorted) if (r.account) counts.set(r.account.id, (counts.get(r.account.id) ?? 0) + 1)
  for (const [id, n] of counts) if (n > 1) multi.add(id)
  const placed = new Set<string>()
  for (const r of sorted) {
    if (r.account && multi.has(r.account.id)) {
      if (placed.has(r.account.id)) continue
      placed.add(r.account.id)
      const rs = sorted.filter(x => x.account?.id === r.account!.id)
      groups.push({ account: r.account, rows: rs, subtotal: sumPnl(rs.map(x => x.pnl), "subtotal") })
    } else {
      groups.push({ account: r.account, rows: [r], subtotal: null })
    }
  }

  const total = sumPnl(rows.map(r => r.pnl), "total")
  const underMin = minHourlyRate ? rows.filter(r => r.pnl.perHr != null && r.pnl.perHr < minHourlyRate).length : 0
  const negative = rows.filter(r => r.pnl.marginPct != null && r.pnl.marginPct < 0).length
  const noHours = rows.filter(r => r.pnl.hours === 0).length
  const missingRates = Array.from(new Set(rows.flatMap(r => r.pnl.missingRates)))

  function clickHeader(key: SortKey) {
    setSort(prev => prev.key === key ? { key, dir: prev.dir === "desc" ? "asc" : "desc" } : { key, dir: key === "project" || key === "account" ? "asc" : "desc" })
  }
  const arrow = (key: SortKey) => sort.key === key ? (sort.dir === "desc" ? " ↓" : " ↑") : ""

  const cols: { key: SortKey; label: string; left?: boolean }[] = [
    { key: "project", label: "Project", left: true },
    { key: "account", label: "Client", left: true },
    { key: "revenue", label: "Revenue" },
    { key: "hours", label: "Hours" },
    { key: "teamCost", label: "Team cost" },
    { key: "directCost", label: "Costs" },
    { key: "margin", label: "Margin" },
    { key: "marginPct", label: "Margin %" },
    { key: "perHr", label: "Rev / hr" },
  ]

  function PnlCells({ p, bold }: { p: MonthPnl; bold?: boolean }) {
    const fw = bold ? 700 : 400
    return (
      <>
        <td style={{ ...td, fontWeight: fw }}>{p.revenue > 0 ? fmt(p.revenue) : <span style={{ color: "#C0BAB2" }}>—</span>}</td>
        <td style={{ ...td, fontWeight: fw }}>{p.hours > 0 ? fmtHrs(p.hours) : <span style={{ color: "#C0BAB2" }}>—</span>}</td>
        <td style={{ ...td, fontWeight: fw }}>{p.teamCost > 0 ? fmt(p.teamCost) : <span style={{ color: "#C0BAB2" }}>—</span>}</td>
        <td style={{ ...td, fontWeight: fw }}>{p.directCost > 0 ? fmt(p.directCost) : <span style={{ color: "#C0BAB2" }}>—</span>}</td>
        <td style={{ ...td, fontWeight: 700, color: marginColor(p.marginPct) }}>{p.revenue > 0 || p.teamCost > 0 || p.directCost > 0 ? fmt(p.margin) : <span style={{ color: "#C0BAB2" }}>—</span>}</td>
        <td style={{ ...td, fontWeight: 700, color: marginColor(p.marginPct) }}>{fmtPct(p.marginPct)}</td>
        <td style={{ ...td, fontWeight: fw, color: minHourlyRate && p.perHr != null && p.perHr < minHourlyRate ? "#B23A1B" : td.color }}>{p.perHr != null ? fmt(p.perHr) : <span style={{ color: "#C0BAB2" }}>—</span>}</td>
      </>
    )
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 20 }}>
      <style>{`.profit-scroll { overflow-x: auto; } .profit-scroll table { border-collapse: collapse; width: 100%; } .profit-row:hover td { background: #FBFAF7; }`}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1A1916" }}>Profit by project</div>
          <div style={{ fontSize: 11, color: "#9C9590", marginTop: 2 }}>
            Revenue − team cost (hours × cost/hr) − direct costs. Log hours and costs on each project&apos;s page. Overhead isn&apos;t allocated.
            {mode === "lifetime" && " Project to date counts only months with something logged (shown as logged/elapsed)."}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 2, background: "#F5F1EC", borderRadius: 6, padding: 2 }}>
            {([["month", "By month"], ["lifetime", "Project to date"]] as const).map(([v, l]) => (
              <button key={v} onClick={() => setMode(v)} style={{ padding: "4px 12px", fontSize: 12, fontWeight: 600, border: "none", borderRadius: 4, cursor: "pointer", background: mode === v ? "#fff" : "transparent", color: mode === v ? "#1A1916" : "#9C9590", boxShadow: mode === v ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>{l}</button>
            ))}
          </div>
          {mode === "month" && (
            <select value={month} onChange={e => setMonth(e.target.value)} style={{ padding: "5px 10px", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 13, background: "#fff", color: "#1A1916", fontFamily: "inherit" }}>
              {monthOptions.map(m => <option key={m} value={m}>{ymLabel(m)}{m === now ? " (current)" : ""}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Summary strip */}
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 14, fontSize: 12, color: "#6B6760" }}>
        <span><strong style={{ color: "#1A1916" }}>{fmt(total.revenue)}</strong> revenue</span>
        <span><strong style={{ color: "#1A1916" }}>{fmt(total.teamCost + total.directCost)}</strong> cost</span>
        <span><strong style={{ color: marginColor(total.marginPct) }}>{fmt(total.margin)}</strong> margin ({fmtPct(total.marginPct)})</span>
        {negative > 0 && <span style={{ color: "#B23A1B", fontWeight: 600 }}>{negative} losing money</span>}
        {underMin > 0 && <span style={{ color: "#B45309", fontWeight: 600 }}>{underMin} under min $/hr</span>}
        {noHours > 0 && <span style={{ color: "#9C9590" }}>{noHours} with no hours logged</span>}
      </div>
      {missingRates.length > 0 && (
        <div style={{ background: "#FEF3C7", border: "1px solid #F3D68B", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#8A5A0B", marginBottom: 12 }}>
          No cost rate for {missingRates.join(", ")} — set a salary and billable hours on the <Link href={`/clients/${clientSlug}/team`} style={{ color: "#8A5A0B" }}>Team tab</Link> so their hours count.
        </div>
      )}

      <div className="profit-scroll">
        <table>
          <thead>
            <tr>
              {cols.map(c => <th key={c.key} onClick={() => clickHeader(c.key)} style={{ ...th, textAlign: c.left ? "left" : "right", color: sort.key === c.key ? "#1A1916" : th.color }}>{c.label}{arrow(c.key)}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={cols.length} style={{ ...td, textAlign: "left", color: "#9C9590" }}>No projects delivered in {ymLabel(month)}.</td></tr>
            )}
            {groups.map((g, gi) => (
              <Fragment key={g.account?.id ?? `solo-${gi}`}>
                {g.subtotal && (
                  <tr style={{ borderTop: "1px solid #ECE7DE", background: "#FBFAF7" }}>
                    <td style={{ ...td, textAlign: "left", fontWeight: 700 }} colSpan={2}>
                      <Link href={`/clients/${clientSlug}/accounts/${g.account!.id}`} style={{ color: "#1A1916", textDecoration: "none" }}>{g.account!.name}</Link>
                      <span style={{ color: "#9C9590", fontWeight: 400 }}> · {g.rows.length} projects</span>
                    </td>
                    <PnlCells p={g.subtotal} bold />
                  </tr>
                )}
                {g.rows.map(r => (
                  <tr key={r.c.id} className="profit-row" style={{ borderTop: "1px solid #F5F1EC" }}>
                    <td style={{ ...td, textAlign: "left", paddingLeft: g.subtotal ? 24 : 10 }}>
                      <Link href={`/clients/${clientSlug}/projects/${r.c.id}`} style={{ color: "#1A1916", textDecoration: "none", fontWeight: 600, borderBottom: "1px dotted #C0BAB2" }}>{r.c.name}</Link>
                      {r.c.type === "oneoff" && <span style={{ fontSize: 9, fontWeight: 700, color: "#1D4ED8", background: "#EFF6FF", borderRadius: 4, padding: "1px 5px", marginLeft: 6 }}>ONE-OFF</span>}
                      {r.c.status === "finished" && <span style={{ fontSize: 9, fontWeight: 700, color: "#6B6760", background: "#F5F1EC", borderRadius: 4, padding: "1px 5px", marginLeft: 6 }}>FINISHED</span>}
                      {mode === "lifetime" && r.pnl.elapsedMonths != null && (
                        <span style={{ fontSize: 10, color: (r.pnl.loggedMonths ?? 0) < r.pnl.elapsedMonths ? "#B45309" : "#9C9590", marginLeft: 6 }} title="Months with hours or costs logged, out of months elapsed — unlogged months are left out">
                          {r.pnl.loggedMonths}/{r.pnl.elapsedMonths} mo
                        </span>
                      )}
                    </td>
                    <td style={{ ...td, textAlign: "left", color: "#6B6760" }}>
                      {g.subtotal ? "" : r.account
                        ? <Link href={`/clients/${clientSlug}/accounts/${r.account.id}`} style={{ color: "#6B6760", textDecoration: "none" }}>{r.account.name}</Link>
                        : <span style={{ color: "#C2410C", fontWeight: 700, fontSize: 10, textTransform: "uppercase" }}>Unassigned</span>}
                    </td>
                    <PnlCells p={r.pnl} />
                  </tr>
                ))}
              </Fragment>
            ))}
            {rows.length > 0 && (
              <tr style={{ borderTop: "2px solid #ECE7DE", background: "#FBFAF7" }}>
                <td style={{ ...td, textAlign: "left", fontWeight: 700 }} colSpan={2}>Total · {rows.length} project{rows.length === 1 ? "" : "s"}</td>
                <PnlCells p={total} bold />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
