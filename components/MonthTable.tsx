"use client"
import { useState, useCallback } from "react"
import { netProfit, grossProfit, netMargin } from "@/lib/calc"

interface StoredRow {
  month: string
  revenue: number
  totalExpenses: number
  salaries: number
  software: number
  cashInBank: number
  leads: number
  newClients: number
  closeRate: number
  churn: number
}

interface Props {
  clientId: string
  months: StoredRow[]
  onUpdate?: (month: string, field: string, value: number) => void
  onBulkImport?: (rows: StoredRow[]) => void
}

// ── Bulk import ───────────────────────────────────────────────────────────────

interface ParsedMetricRow {
  month: string
  revenue: number
  totalExpenses: number
  salaries: number
  software: number
  cashInBank: number
  leads: number
  newClients: number
  churn: number
  errors: string[]
}

function parseNum(raw: string): number {
  const n = parseFloat(raw.replace(/[$,\s%]/g, ""))
  return isNaN(n) ? 0 : n
}

function normalizeMonth(raw: string): string {
  const s = raw.trim()
  if (/^\d{4}-\d{2}$/.test(s)) return s
  const mmyyyy = s.match(/^(\d{1,2})\/(\d{4})$/)
  if (mmyyyy) return `${mmyyyy[2]}-${mmyyyy[1].padStart(2, "0")}`
  return ""
}

function parseMetricsPaste(text: string): ParsedMetricRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (!lines.length) return []
  const first = lines[0].split(/\t/)[0].trim().toLowerCase()
  const dataLines = first === "month" ? lines.slice(1) : lines

  return dataLines.map(line => {
    const cols = line.split(/\t/).map(s => s.trim())
    const [rawMonth = "", rawRevenue = "", rawExpenses = "", rawSalaries = "",
           rawSoftware = "", rawCash = "", rawLeads = "", rawNewClients = "", rawChurn = ""] = cols

    const errors: string[] = []
    const month = normalizeMonth(rawMonth)
    if (!month) errors.push("Invalid month (use YYYY-MM)")

    return {
      month,
      revenue: parseNum(rawRevenue),
      totalExpenses: parseNum(rawExpenses),
      salaries: parseNum(rawSalaries),
      software: parseNum(rawSoftware),
      cashInBank: parseNum(rawCash),
      leads: parseNum(rawLeads),
      newClients: parseNum(rawNewClients),
      churn: parseNum(rawChurn),
      errors,
    }
  })
}

function fmtPreview(v: number, col: number): string {
  // cols 0=month, 1-5=currency, 6-8=number
  if (col >= 1 && col <= 5) return v === 0 ? "—" : "$" + Math.round(v).toLocaleString()
  return v === 0 ? "—" : String(Math.round(v))
}

function BulkMetricsModal({ clientId, onClose, onImport }: {
  clientId: string
  onClose: () => void
  onImport: (rows: StoredRow[]) => void
}) {
  const [text, setText] = useState("")
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rows = text.trim() ? parseMetricsPaste(text) : []
  const validRows = rows.filter(r => r.errors.length === 0)

  async function handleImport() {
    if (!validRows.length) return
    setImporting(true)
    setError(null)
    const res = await fetch(`/api/clients/${clientId}/metrics/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validRows.map(({ errors: _e, ...r }) => r)),
    })
    setImporting(false)
    if (!res.ok) { setError("Import failed — check your data and try again"); return }
    const created: StoredRow[] = await res.json()
    onImport(created)
    onClose()
  }

  const HEADERS = ["Month", "Revenue", "Total Expenses", "Salaries", "Software", "Cash in Bank", "Leads", "New Clients", "Churn", ""]

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: "#fff", borderRadius: 14, padding: 28, width: "min(860px, 100%)", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <h2 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 22, fontWeight: 600, margin: "0 0 4px", color: "#1A1916" }}>Bulk Import Monthly Metrics</h2>
          <p style={{ fontSize: 12, color: "#9C9590", margin: 0 }}>
            Paste from a spreadsheet — columns in order:<br />
            <strong>Month · Revenue · Total Expenses · Salaries · Software · Cash in Bank · Leads · New Clients · Churn</strong>
            <br />Month format: YYYY-MM &nbsp;·&nbsp; Dollar signs and commas are stripped automatically &nbsp;·&nbsp; Existing months are overwritten
          </p>
        </div>

        <textarea
          autoFocus
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={"2026-01\t12000\t8000\t5000\t200\t15000\t24\t3\t1\n2026-02\t13500\t8200\t5000\t200\t18000\t30\t4\t0"}
          style={{ width: "100%", height: 120, padding: "10px 12px", border: "1px solid #ECE7DE", borderRadius: 8, fontSize: 12, fontFamily: "monospace", resize: "vertical", boxSizing: "border-box", outline: "none", color: "#1A1916" }}
        />

        {rows.length > 0 && (
          <div style={{ overflowX: "auto", border: "1px solid #ECE7DE", borderRadius: 8 }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#FBFAF7" }}>
                  {HEADERS.map(h => (
                    <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontWeight: 600, color: "#9C9590", fontSize: 11, borderBottom: "1px solid #ECE7DE", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const vals = [row.revenue, row.totalExpenses, row.salaries, row.software, row.cashInBank, row.leads, row.newClients, row.churn]
                  return (
                    <tr key={i} style={{ background: row.errors.length ? "#FFF5F5" : "transparent" }}>
                      <td style={{ padding: "6px 10px", borderBottom: "1px solid #F5F1EC", fontVariantNumeric: "tabular-nums", color: row.month ? "#1A1916" : "#C2410C" }}>
                        {row.month || <em>invalid</em>}
                      </td>
                      {vals.map((v, ci) => (
                        <td key={ci} style={{ padding: "6px 10px", borderBottom: "1px solid #F5F1EC", color: "#6B6760", fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
                          {fmtPreview(v, ci + 1)}
                        </td>
                      ))}
                      <td style={{ padding: "6px 10px", borderBottom: "1px solid #F5F1EC" }}>
                        {row.errors.length
                          ? <span style={{ color: "#C2410C", fontSize: 11 }}>⚠ {row.errors.join(", ")}</span>
                          : <span style={{ color: "#166534", fontSize: 13 }}>✓</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {error && <div style={{ fontSize: 13, color: "#C2410C" }}>{error}</div>}

        <div style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 12, color: "#9C9590" }}>
            {rows.length > 0 && (
              validRows.length === rows.length
                ? `${rows.length} month${rows.length !== 1 ? "s" : ""} ready to import`
                : `${validRows.length} of ${rows.length} rows valid — fix errors to include them`
            )}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={onClose}
              style={{ padding: "8px 16px", background: "none", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 13, cursor: "pointer", color: "#6B6760" }}>
              Cancel
            </button>
            <button onClick={handleImport} disabled={importing || validRows.length === 0}
              style={{ padding: "8px 18px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: importing || validRows.length === 0 ? "default" : "pointer", opacity: importing || validRows.length === 0 ? 0.5 : 1 }}>
              {importing ? "Importing…" : `Import ${validRows.length} Month${validRows.length !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

const EDITABLE_ROWS = [
  { key: "revenue", label: "Revenue", format: "currency" },
  { key: "totalExpenses", label: "Total Expenses", format: "currency" },
  { key: "salaries", label: "Salaries", format: "currency" },
  { key: "software", label: "Software", format: "currency" },
  { key: "cashInBank", label: "Cash in Bank", format: "currency" },
  { key: "leads", label: "Leads", format: "number" },
  { key: "newClients", label: "New Clients", format: "number" },
  { key: "churn", label: "Churn", format: "number" },
] as const

const DERIVED_ROWS = [
  { key: "netProfit", label: "Net Profit", format: "currency" },
  { key: "grossProfit", label: "Gross Profit", format: "currency" },
  { key: "netMargin", label: "Net Margin", format: "percent" },
  { key: "closeRate", label: "Close Rate", format: "percent" },
] as const

type EditableKey = typeof EDITABLE_ROWS[number]["key"]

function fmtDisplay(v: number, format: string): string {
  if (format === "currency") return "$" + Math.round(v).toLocaleString()
  if (format === "percent") return (Math.round(v * 10) / 10) + "%"
  return String(Math.round(v))
}

function parseInput(raw: string, format: string): number {
  const cleaned = raw.replace(/[$,%\s]/g, "").replace(/k$/i, "000")
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}

function monthLabel(ym: string): string {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  const [, m] = ym.split("-").map(Number)
  return months[m - 1]
}

export default function MonthTable({ clientId, months, onUpdate, onBulkImport }: Props) {
  const [data, setData] = useState<Record<string, Record<string, number>>>(() => {
    const m: Record<string, Record<string, number>> = {}
    months.forEach(({ month, ...rest }) => { m[month] = rest })
    return m
  })
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [bulkOpen, setBulkOpen] = useState(false)

  const getDerived = useCallback((month: string) => {
    const r = data[month] ?? {}
    const leads = r.leads ?? 0
    const newClients = r.newClients ?? 0
    return {
      netProfit: netProfit(r.revenue ?? 0, r.totalExpenses ?? 0),
      grossProfit: grossProfit(r.revenue ?? 0, r.salaries ?? 0, r.software ?? 0),
      netMargin: netMargin(r.revenue ?? 0, r.totalExpenses ?? 0),
      closeRate: leads > 0 ? (newClients / leads) * 100 : 0,
    }
  }, [data])

  async function handleBlur(month: string, field: EditableKey, raw: string, format: string) {
    const value = parseInput(raw, format)
    const key = `${month}:${field}`
    setSaving(s => ({ ...s, [key]: true }))
    try {
      await fetch(`/api/clients/${clientId}/metrics/${month}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      })
      setData(prev => {
        const updated = { ...prev, [month]: { ...(prev[month] ?? {}), [field]: value } }
        return updated
      })
      onUpdate?.(month, field, value)
    } finally {
      setSaving(s => ({ ...s, [key]: false }))
    }
  }

  const bulkButton = (
    <button
      onClick={() => setBulkOpen(true)}
      style={{ padding: "5px 12px", background: "none", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 12, fontWeight: 600, color: "#6B6760", cursor: "pointer" }}
    >
      Bulk Import
    </button>
  )

  if (!months.length) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {bulkOpen && <BulkMetricsModal clientId={clientId} onClose={() => setBulkOpen(false)} onImport={rows => { onBulkImport?.(rows); setBulkOpen(false) }} />}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>{bulkButton}</div>
        <div style={{ color: "#9C9590", fontSize: 14, padding: 16 }}>No monthly data yet.</div>
      </div>
    )
  }

  const thStyle: React.CSSProperties = {
    padding: "8px 12px",
    fontSize: 11,
    fontWeight: 600,
    color: "#9C9590",
    textAlign: "right",
    whiteSpace: "nowrap",
    background: "#FBFAF7",
    borderBottom: "1px solid #ECE7DE",
    position: "sticky",
    top: 0,
  }
  const rowLabelStyle: React.CSSProperties = {
    padding: "7px 12px",
    fontSize: 12,
    color: "#6B6760",
    whiteSpace: "nowrap",
    background: "#FBFAF7",
    borderRight: "1px solid #ECE7DE",
    position: "sticky",
    left: 0,
    fontWeight: 500,
  }
  const cellStyle: React.CSSProperties = {
    padding: "0",
    borderRight: "1px solid #F5F1EC",
    borderBottom: "1px solid #F5F1EC",
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
    {bulkOpen && <BulkMetricsModal clientId={clientId} onClose={() => setBulkOpen(false)} onImport={rows => { onBulkImport?.(rows); setBulkOpen(false) }} />}
    <div style={{ display: "flex", justifyContent: "flex-end" }}>{bulkButton}</div>
    <div style={{ overflowX: "auto", border: "1px solid #ECE7DE", borderRadius: 10, background: "#fff" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "max-content" }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, textAlign: "left", position: "sticky", left: 0, zIndex: 2, minWidth: 120 }}>Metric</th>
            {months.map(m => (
              <th key={m.month} style={thStyle}>{monthLabel(m.month)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Derived rows (read-only, shown first for context) */}
          {DERIVED_ROWS.map(row => (
            <tr key={row.key} style={{ background: "#F8F6F2" }}>
              <td style={{ ...rowLabelStyle, color: "#9C9590", fontStyle: "italic" }}>{row.label}</td>
              {months.map(m => {
                const d = getDerived(m.month)
                const v = d[row.key as keyof typeof d]
                return (
                  <td key={m.month} style={{ ...cellStyle, padding: "7px 12px", textAlign: "right", fontSize: 12, color: "#9C9590", fontVariantNumeric: "tabular-nums" }}>
                    {fmtDisplay(v, row.format)}
                  </td>
                )
              })}
            </tr>
          ))}

          {/* Divider */}
          <tr><td colSpan={months.length + 1} style={{ height: 1, background: "#ECE7DE" }} /></tr>

          {/* Editable rows */}
          {EDITABLE_ROWS.map(row => (
            <tr key={row.key}>
              <td style={rowLabelStyle}>{row.label}</td>
              {months.map(m => {
                const v = data[m.month]?.[row.key] ?? 0
                const isSaving = saving[`${m.month}:${row.key}`]
                return (
                  <td key={m.month} style={cellStyle}>
                    <input
                      defaultValue={fmtDisplay(v, row.format)}
                      key={`${m.month}:${row.key}:${v}`}
                      onBlur={e => handleBlur(m.month, row.key, e.target.value, row.format)}
                      style={{
                        width: "100%",
                        padding: "7px 12px",
                        border: "none",
                        background: isSaving ? "#FFFBE8" : "transparent",
                        fontSize: 12,
                        color: "#1A1916",
                        fontVariantNumeric: "tabular-nums",
                        textAlign: "right",
                        outline: "none",
                        boxSizing: "border-box",
                        minWidth: 90,
                      }}
                      onFocus={e => {
                        const raw = String(data[m.month]?.[row.key] ?? 0)
                        e.target.value = raw
                        e.target.select()
                      }}
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </div>
  )
}
