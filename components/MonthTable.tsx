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
}

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

export default function MonthTable({ clientId, months, onUpdate }: Props) {
  const [data, setData] = useState<Record<string, Record<string, number>>>(() => {
    const m: Record<string, Record<string, number>> = {}
    months.forEach(({ month, ...rest }) => { m[month] = rest })
    return m
  })
  const [saving, setSaving] = useState<Record<string, boolean>>({})

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

  if (!months.length) {
    return <div style={{ color: "#9C9590", fontSize: 14, padding: 16 }}>No monthly data yet.</div>
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
  )
}
