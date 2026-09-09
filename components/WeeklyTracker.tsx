"use client"
import { Fragment, useState, useMemo } from "react"
import { useFmtCurrency } from "@/lib/CurrencyContext"
import {
  weeksInYear, weeksInMonth, monthOfWeek, weekNumberInMonth, weekRangeLabel,
  quarterOfMonth, quarterLabel, currentWeek, parseWeekCell, type WeekStart,
} from "@/lib/weeks"
import { ymLabel } from "@/lib/calc"

export interface WeeklyRow {
  weekStart: string
  leads: number
  callsScheduled: number
  callsHeld: number
  deepDives: number
  proposalsSent: number
  newClients: number
  marketingSpend: number
  revenue: number
}

type Field = Exclude<keyof WeeklyRow, "weekStart">

const COLUMNS: { key: Field; label: string; money?: boolean }[] = [
  { key: "leads", label: "Leads" },
  { key: "callsScheduled", label: "Calls Scheduled" },
  { key: "callsHeld", label: "Calls Had" },
  { key: "deepDives", label: "Deep Dives" },
  { key: "proposalsSent", label: "Proposals Sent" },
  { key: "newClients", label: "New Clients" },
  { key: "marketingSpend", label: "Marketing Spend", money: true },
  { key: "revenue", label: "Revenue in Bank", money: true },
]

const EMPTY: Record<Field, number> = {
  leads: 0, callsScheduled: 0, callsHeld: 0, deepDives: 0,
  proposalsSent: 0, newClients: 0, marketingSpend: 0, revenue: 0,
}

function parseInput(raw: string): number {
  const n = parseFloat(raw.replace(/[$£€,\s]/g, "").replace(/k$/i, "000"))
  return isNaN(n) ? 0 : n
}

// ── Paste import ──────────────────────────────────────────────────────────────

// Header aliases, normalised to lowercase alphanumerics. A pasted sheet rarely
// uses these column names in this order, so mapping by name beats mapping by
// position — and any column the paste lacks simply stays zero.
const HEADER_ALIASES: Record<Field, string[]> = {
  leads: ["leads", "newleads"],
  callsScheduled: ["salescallsschedule", "salescallsscheduled", "callsscheduled", "callsschedule", "scheduled"],
  callsHeld: ["salescallshad", "callshad", "callsheld", "held", "salescalls"],
  deepDives: ["deepdivestrategycalls", "deepdivecalls", "deepdives", "deepdive", "strategycalls"],
  proposalsSent: ["proposalssent", "proposals", "proposal"],
  newClients: ["newclients", "clientswon", "won", "closed"],
  marketingSpend: ["marketingspend", "marketing", "adspend", "spend"],
  revenue: ["revenueinbank", "revenuecollected", "cashcollected", "revenue", "collected", "cash"],
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "")

/** Column index → field, from a header row. Null when it isn't a header. */
function mapHeader(cells: string[]): (Field | null)[] | null {
  const mapped = cells.map(c => {
    const n = norm(c)
    if (!n) return null
    for (const f of Object.keys(HEADER_ALIASES) as Field[]) {
      if (HEADER_ALIASES[f].includes(n)) return f
    }
    return null
  })
  return mapped.some(Boolean) ? mapped : null
}

interface ParsedWeekRow {
  weekStart: string | null
  label: string
  raw: string
  values: Record<Field, number>
}

function parseWeeklyPaste(text: string, year: number): ParsedWeekRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (!lines.length) return []

  const firstCells = lines[0].split(/\t/).map(s => s.trim())
  const header = mapHeader(firstCells)
  // No header row? Fall back to this table's own column order.
  const layout: (Field | null)[] = header ?? [null, ...COLUMNS.map(c => c.key)]
  const dataLines = header ? lines.slice(1) : lines

  return dataLines.map(line => {
    const cells = line.split(/\t/).map(s => s.trim())
    const values = { ...EMPTY }
    for (let i = 0; i < cells.length; i++) {
      const f = layout[i]
      if (f) values[f] = parseInput(cells[i])
    }
    const weekStart = parseWeekCell(cells[0] ?? "", year)
    return {
      weekStart,
      label: weekStart ? weekRangeLabel(weekStart) : "",
      raw: cells[0] ?? "",
      values,
    }
  })
}

function ImportModal({ clientId, year, onClose, onImport }: {
  clientId: string
  year: number
  onClose: () => void
  onImport: (rows: WeeklyRow[]) => void
}) {
  const fmt$ = useFmtCurrency()
  const [text, setText] = useState("")
  const [importYear, setImportYear] = useState(year)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rows = text.trim() ? parseWeeklyPaste(text, importYear) : []
  const usable = rows.filter(r => r.weekStart)
  const skipped = rows.length - usable.length

  // Two pasted rows can land on one week (a merged label like "Jan 1-10").
  // Sum them rather than letting the later row silently win.
  const merged = useMemo(() => {
    const m = new Map<string, Record<Field, number>>()
    for (const r of usable) {
      const prev = m.get(r.weekStart!)
      if (!prev) { m.set(r.weekStart!, { ...r.values }); continue }
      for (const c of COLUMNS) prev[c.key] += r.values[c.key]
    }
    return m
  }, [usable])
  const collisions = usable.length - merged.size

  async function handleImport() {
    if (!merged.size) return
    setImporting(true)
    setError(null)
    const payload = [...merged.entries()].map(([weekStart, v]) => ({ weekStart, ...v }))
    const res = await fetch(`/api/clients/${clientId}/weekly`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    setImporting(false)
    if (!res.ok) { setError("Import failed — check the rows and try again"); return }
    onImport(await res.json())
    onClose()
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 28, width: "min(900px, 100%)", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <h2 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 22, fontWeight: 600, margin: "0 0 4px", color: "#1A1916" }}>Import Weeks</h2>
          <p style={{ fontSize: 12, color: "#9C9590", margin: 0, lineHeight: 1.5 }}>
            Paste straight from your spreadsheet, <strong>including the header row</strong> — columns are matched by
            name, so any order works and missing columns stay empty. The first column is the week: a date
            (<code>2026-03-29</code>, <code>3/29/2026</code>) or a label (<code>Mar 29 – Apr 4</code>), snapped to
            that week&apos;s Sunday. Month and quarter subtotal rows are skipped automatically. Imported weeks
            replace what&apos;s there.
          </p>
        </div>

        <label style={{ fontSize: 12, color: "#6B6760", display: "flex", alignItems: "center", gap: 8 }}>
          Year for labels without one
          <input type="number" value={importYear} onChange={e => setImportYear(parseInt(e.target.value, 10) || year)}
            style={{ width: 90, padding: "6px 10px", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 13, color: "#1A1916" }} />
        </label>

        <textarea autoFocus value={text} onChange={e => setText(e.target.value)}
          placeholder={"Week\tLeads\tSales Calls Schedule\tSales Calls Had\tDeep Dive Strategy Calls\tNew Clients\tRevenue in bank\nJan 11-17\t3\t1\t1\t2\t1\t$7,275.00"}
          style={{ width: "100%", height: 130, padding: "10px 12px", border: "1px solid #ECE7DE", borderRadius: 8, fontSize: 12, fontFamily: "monospace", resize: "vertical", boxSizing: "border-box", outline: "none", color: "#1A1916" }} />

        {rows.length > 0 && (
          <div style={{ overflowX: "auto", border: "1px solid #ECE7DE", borderRadius: 8, maxHeight: 300 }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#FBFAF7" }}>
                  {["Week", ...COLUMNS.map(c => c.label)].map(h => (
                    <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontWeight: 600, color: "#9C9590", fontSize: 11, borderBottom: "1px solid #ECE7DE", whiteSpace: "nowrap", position: "sticky", top: 0, background: "#FBFAF7" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} style={{ background: r.weekStart ? "transparent" : "#FAF9F7" }}>
                    <td style={{ padding: "6px 10px", borderBottom: "1px solid #F5F1EC", whiteSpace: "nowrap", color: r.weekStart ? "#1A1916" : "#B5AEA6" }}>
                      {r.weekStart ? r.label : <em>skipped — {r.raw || "blank"}</em>}
                    </td>
                    {COLUMNS.map(c => (
                      <td key={c.key} style={{ padding: "6px 10px", borderBottom: "1px solid #F5F1EC", color: "#6B6760", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {r.weekStart && r.values[c.key] ? (c.money ? fmt$(r.values[c.key]) : r.values[c.key]) : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {error && <div style={{ fontSize: 13, color: "#C2410C" }}>{error}</div>}

        <div style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontSize: 12, color: "#9C9590" }}>
            {rows.length > 0 && (
              <>
                {merged.size} week{merged.size !== 1 ? "s" : ""} ready
                {skipped > 0 && ` · ${skipped} row${skipped !== 1 ? "s" : ""} skipped`}
                {collisions > 0 && ` · ${collisions} merged into an existing week`}
              </>
            )}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={onClose}
              style={{ padding: "8px 16px", background: "none", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 13, cursor: "pointer", color: "#6B6760" }}>
              Cancel
            </button>
            <button onClick={handleImport} disabled={importing || merged.size === 0}
              style={{ padding: "8px 18px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: importing || !merged.size ? "default" : "pointer", opacity: importing || !merged.size ? 0.5 : 1 }}>
              {importing ? "Importing…" : `Import ${merged.size} Week${merged.size !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

interface Props {
  clientId: string
  initialRows: WeeklyRow[]
  /** Read-only for viewers who shouldn't edit the numbers. */
  readOnly?: boolean
}

export default function WeeklyTracker({ clientId, initialRows, readOnly = false }: Props) {
  const fmt$ = useFmtCurrency()
  const [data, setData] = useState<Record<WeekStart, Record<Field, number>>>(() => {
    const m: Record<string, Record<Field, number>> = {}
    for (const { weekStart, ...rest } of initialRows) m[weekStart] = rest
    return m
  })
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [failed, setFailed] = useState<Record<string, boolean>>({})
  const [showImport, setShowImport] = useState(false)

  const thisWeek = currentWeek()
  const thisYear = new Date().getUTCFullYear()

  // Offer every year that has data, plus the current one. Driven off `data`
  // rather than the initial rows so an import's year appears straight away.
  const years = useMemo(() => {
    const ys = new Set<number>([thisYear])
    for (const w of Object.keys(data)) ys.add(parseInt(w.slice(0, 4), 10))
    return [...ys].sort((a, b) => b - a)
  }, [data, thisYear])
  const [year, setYear] = useState(thisYear)

  // The year's weeks, grouped quarter → month, so subtotal rows can be
  // interleaved in one pass the way the spreadsheet reads.
  const groups = useMemo(() => {
    const byMonth = new Map<string, WeekStart[]>()
    for (const w of weeksInYear(year)) {
      const m = monthOfWeek(w)
      if (!byMonth.has(m)) byMonth.set(m, [])
      byMonth.get(m)!.push(w)
    }
    const byQuarter = new Map<string, string[]>()
    for (const m of byMonth.keys()) {
      const q = quarterOfMonth(m)
      if (!byQuarter.has(q)) byQuarter.set(q, [])
      byQuarter.get(q)!.push(m)
    }
    return [...byQuarter.entries()].map(([q, months]) => ({ q, months }))
  }, [year])

  const rowOf = (w: WeekStart) => data[w] ?? EMPTY

  const sum = (weeks: WeekStart[]) => {
    const t = { ...EMPTY }
    for (const w of weeks) {
      const r = rowOf(w)
      for (const c of COLUMNS) t[c.key] += r[c.key]
    }
    return t
  }

  async function save(week: WeekStart, field: Field, raw: string) {
    const value = parseInput(raw)
    if (rowOf(week)[field] === value) return

    const key = `${week}:${field}`
    const prev = rowOf(week)
    // Optimistic — the grid stays responsive while typing down a column.
    setData(d => ({ ...d, [week]: { ...prev, [field]: value } }))
    setSaving(s => ({ ...s, [key]: true }))
    setFailed(f => ({ ...f, [key]: false }))
    try {
      const res = await fetch(`/api/clients/${clientId}/weekly`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart: week, [field]: value }),
      })
      if (!res.ok) throw new Error(String(res.status))
    } catch {
      setData(d => ({ ...d, [week]: prev }))
      setFailed(f => ({ ...f, [key]: true }))
    } finally {
      setSaving(s => ({ ...s, [key]: false }))
    }
  }

  const yearTotal = sum(weeksInYear(year))

  // ── styles ────────────────────────────────────────────────────────────────
  const th: React.CSSProperties = {
    padding: "10px 12px", fontSize: 11, fontWeight: 600, color: "#9C9590",
    textAlign: "right", whiteSpace: "nowrap", borderBottom: "2px solid #ECE7DE",
    position: "sticky", top: 0, background: "#FDFCFA", zIndex: 2,
  }
  const labelCell: React.CSSProperties = {
    padding: "6px 12px", fontSize: 13, whiteSpace: "nowrap",
    position: "sticky", left: 0, zIndex: 1, textAlign: "left",
  }
  const numCell: React.CSSProperties = { padding: 0, textAlign: "right" }
  const totalCell: React.CSSProperties = {
    padding: "8px 12px", fontSize: 13, fontWeight: 600, textAlign: "right", whiteSpace: "nowrap",
  }

  function TotalRow({ label, weeks, tint, strong }: { label: string; weeks: WeekStart[]; tint: string; strong?: boolean }) {
    const t = sum(weeks)
    return (
      <tr style={{ background: tint }}>
        <td style={{ ...labelCell, ...totalCell, background: tint, fontWeight: strong ? 700 : 600 }}>{label}</td>
        {COLUMNS.map(c => (
          <td key={c.key} style={{ ...totalCell, fontWeight: strong ? 700 : 600, color: t[c.key] ? "#1A1916" : "#C9C2BA" }}>
            {t[c.key] ? (c.money ? fmt$(t[c.key]) : t[c.key].toLocaleString()) : "—"}
          </td>
        ))}
      </tr>
    )
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#1A1916", marginBottom: 2 }}>Weekly Tracker</div>
          <p style={{ fontSize: 11, color: "#9C9590", margin: 0 }}>
            Weeks run Sunday–Saturday and are never split — each is filed under the month it starts in, so a
            month here runs to the end of its last week.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {!readOnly && (
          <button onClick={() => setShowImport(true)}
            style={{ fontSize: 12, fontWeight: 600, color: "#6B6760", background: "#fff", border: "1px solid #ECE7DE", borderRadius: 7, padding: "8px 14px", cursor: "pointer" }}>
            Import
          </button>
        )}
        <div style={{ display: "flex", border: "1px solid #ECE7DE", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
          {years.map(y => (
            <button key={y} onClick={() => setYear(y)} aria-pressed={year === y}
              style={{
                fontSize: 12, fontWeight: 600, padding: "8px 14px", border: "none", cursor: "pointer",
                background: year === y ? "#1A1916" : "#fff", color: year === y ? "#fff" : "#9C9590",
              }}>
              {y}
            </button>
          ))}
        </div>
        </div>
      </div>

      {showImport && (
        <ImportModal
          clientId={clientId}
          year={year}
          onClose={() => setShowImport(false)}
          onImport={imported => {
            setData(d => {
              const next = { ...d }
              // The API echoes full rows (id, clientId, updatedAt); keep only
              // the tracked columns so the grid's shape stays clean.
              for (const row of imported) {
                const vals = { ...EMPTY }
                for (const c of COLUMNS) vals[c.key] = row[c.key] ?? 0
                next[row.weekStart] = vals
              }
              return next
            })
            // Jump to the year the import landed in, so the result is visible.
            const first = imported[0]?.weekStart
            if (first) setYear(parseInt(first.slice(0, 4), 10))
          }}
        />
      )}

      <div style={{ overflowX: "auto", border: "1px solid #ECE7DE", borderRadius: 10, background: "#FDFCFA" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 900 }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "left", left: 0, zIndex: 3 }}>Week</th>
              {COLUMNS.map(c => <th key={c.key} style={th}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {groups.map(({ q, months }) => (
              <Fragment key={q}>
                {months.map(m => (
                  <Fragment key={m}>
                    {weeksInMonth(m).map(w => {
                      const r = rowOf(w)
                      const isNow = w === thisWeek
                      const bg = isNow ? "#FFF8E8" : "#fff"
                      return (
                        <tr key={w} style={{ background: bg, borderBottom: "1px solid #F4F0E9" }}>
                          <td style={{ ...labelCell, background: bg, color: isNow ? "#1A1916" : "#6B6560", fontWeight: isNow ? 600 : 400 }}>
                            <span style={{ color: "#C9C2BA", marginRight: 8 }}>W{weekNumberInMonth(w)}</span>
                            {weekRangeLabel(w)}
                          </td>
                          {COLUMNS.map(c => {
                            const key = `${w}:${c.key}`
                            return (
                              <td key={c.key} style={numCell}>
                                <input
                                  key={`${key}:${r[c.key]}`}
                                  defaultValue={r[c.key] ? String(r[c.key]) : ""}
                                  onBlur={e => save(w, c.key, e.target.value)}
                                  onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
                                  readOnly={readOnly}
                                  inputMode="decimal"
                                  aria-label={`${c.label}, ${weekRangeLabel(w)}`}
                                  style={{
                                    width: "100%", border: "none", outline: "none", background: "transparent",
                                    padding: "7px 12px", fontSize: 13, textAlign: "right", color: "#1A1916",
                                    fontFamily: "inherit",
                                    boxShadow: failed[key] ? "inset 0 0 0 1px #C0392B" : saving[key] ? "inset 0 0 0 1px #ECE7DE" : "none",
                                    cursor: readOnly ? "default" : "text",
                                  }}
                                />
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                    <TotalRow label={ymLabel(m)} weeks={weeksInMonth(m)} tint="#FBF3E4" />
                  </Fragment>
                ))}
                <TotalRow label={`${quarterLabel(q)} total`} weeks={months.flatMap(weeksInMonth)} tint="#E8EFF7" strong />
              </Fragment>
            ))}
            <tr style={{ background: "#1A1916" }}>
              <td style={{ ...labelCell, ...totalCell, background: "#1A1916", color: "#fff", fontWeight: 700 }}>{year} total</td>
              {COLUMNS.map(c => (
                <td key={c.key} style={{ ...totalCell, color: "#fff", fontWeight: 700 }}>
                  {yearTotal[c.key] ? (c.money ? fmt$(yearTotal[c.key]) : yearTotal[c.key].toLocaleString()) : "—"}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {Object.values(failed).some(Boolean) && (
        <p style={{ fontSize: 12, color: "#C0392B", marginTop: 10 }}>
          A cell didn&apos;t save and was rolled back. Check your connection and re-enter it.
        </p>
      )}
    </div>
  )
}
