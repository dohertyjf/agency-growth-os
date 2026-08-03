"use client"
import { useState } from "react"
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
function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number)
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  return `${names[m - 1]} '${String(y).slice(2)}`
}
function activeInMonth(c: Contract, ym: string) {
  return c.start <= ym && (c.contractedThrough === null || c.contractedThrough >= ym)
}

export default function YieldByMonth({ contracts, accounts, accountMonths, initialHours, minHourlyRate }: {
  contracts: Contract[]
  accounts: Account[]
  accountMonths: AccountMonth[]
  initialHours: HoursRow[]
  minHourlyRate: number | null
}) {
  const fmt$ = useFmtCurrency()
  const [hours, setHours] = useState(() => {
    const m = new Map<string, number>()
    initialHours.forEach(h => m.set(`${h.contractId}:${h.month}`, h.hours))
    return m
  })
  const [month, setMonth] = useState(now)
  const [editing, setEditing] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)

  const hasMin = minHourlyRate != null && minHourlyRate > 0

  // Month options: earliest contract start → current month (hours are logged in retrospect).
  const starts = contracts.map(c => c.start).filter(Boolean)
  const earliest = starts.length ? starts.reduce((a, b) => (a < b ? a : b)) : now
  const monthOptions: string[] = []
  for (let m = earliest > now ? now : earliest; m <= now; m = ymAdd(m, 1)) monthOptions.push(m)
  const months = monthOptions.reverse()

  const rows = contracts
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
    .sort((a, b) => (a.perHr ?? Infinity) - (b.perHr ?? Infinity))

  const underMin = hasMin ? rows.filter(r => r.perHr != null && r.perHr < (minHourlyRate as number)).length : 0

  async function saveHours(contractId: string, raw: string) {
    setEditing(null)
    const v = parseFloat(raw)
    if (isNaN(v) || v < 0) return
    const key = `${contractId}:${month}`
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
      body: JSON.stringify({ month, hours: v }),
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
        <div style={{ fontSize: 13, color: "#9C9590", padding: "16px 0" }}>No active projects in {monthLabel(month)}.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 560 }}>
            <thead>
              <tr>
                {["Project", "Client", "Money", "Sold hrs", "Actual hrs", "$ / hr"].map((h, i) => (
                  <th key={h} style={{ ...th, textAlign: i >= 2 ? "right" : "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ c, accountName, money, sold, actual, perHr, overBudget }) => (
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
                          onBlur={e => saveHours(c.id, e.target.value)}
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
          <div style={{ fontSize: 10, color: "#B0A9A0", marginTop: 8 }}>Sold hrs = the hours this revenue affords at your minimum yield (set in Settings). Actual over budget shows red. Sorted lowest yield first.</div>
        </div>
      )}
    </div>
  )
}
