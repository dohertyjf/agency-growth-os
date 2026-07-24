"use client"
import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import MetricCard from "./MetricCard"
import MetricChart, { ChartPoint } from "./MetricChart"
import MonthTable from "./MonthTable"
import {
  netProfit, grossProfit, netMargin, momDelta, fmtCurrency, fmtPercent,
  projectMetric, ymAdd, ymLabel, currentMRR, bookedActive, bookedPotential, bookedAhead,
  mrrGoal, goalProgress,
  type ContractRow, type ProjectionInput, type ProjectableMetric,
} from "@/lib/calc"

interface Metric {
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

interface Contract {
  id: string
  name: string
  monthly: number
  start: string
  contractedThrough: string
  status: string
  type?: string
}

interface Goal {
  annualRevenue: number
  profit: number
}

type ClientStatus = "potential" | "active" | "paused"

interface Props {
  clientId: string
  clientName: string
  metrics: Metric[]
  contracts: Contract[]
  goal: Goal | null
  initialStatus?: ClientStatus
  initialStartDate?: string | null
  initialEndDate?: string | null
}

type MetricKey = "revenue" | "netProfit" | "grossProfit" | "netMargin" | "leads" | "closeRate" | "newClients" | "churn"
type CardKey = MetricKey | "contractMRR"

const CARDS: { key: MetricKey; label: string; fmt: "currency" | "percent" | "number"; projectable?: boolean }[] = [
  { key: "revenue", label: "Revenue", fmt: "currency", projectable: true },
  { key: "netProfit", label: "Net Profit", fmt: "currency", projectable: true },
  { key: "grossProfit", label: "Gross Profit", fmt: "currency", projectable: true },
  { key: "netMargin", label: "Net Margin", fmt: "percent", projectable: true },
  { key: "leads", label: "Leads", fmt: "number" },
  { key: "closeRate", label: "Close Rate", fmt: "percent" },
  { key: "newClients", label: "New Clients", fmt: "number" },
  { key: "churn", label: "Churn", fmt: "number" },
]

function derivedMetrics(m: Metric) {
  return {
    ...m,
    netProfit: netProfit(m.revenue, m.totalExpenses),
    grossProfit: grossProfit(m.revenue, m.salaries, m.software),
    netMargin: netMargin(m.revenue, m.totalExpenses),
    closeRate: m.leads > 0 ? (m.newClients / m.leads) * 100 : 0,
  }
}

function fmtValue(v: number, fmt: "currency" | "percent" | "number"): string {
  if (fmt === "currency") return fmtCurrency(v)
  if (fmt === "percent") return fmtPercent(v)
  return String(Math.round(v))
}

const STATUS_COLORS: Record<ClientStatus, { bg: string; text: string }> = {
  potential: { bg: "#DBEAFE", text: "#1E40AF" },
  active: { bg: "#DCFCE7", text: "#166534" },
  paused: { bg: "#FEF9C3", text: "#854D0E" },
}

const inputStyle: React.CSSProperties = {
  padding: "7px 10px", border: "1px solid #ECE7DE", borderRadius: 6,
  fontSize: 13, background: "#fff", color: "#1A1916",
  width: "100%", boxSizing: "border-box", fontFamily: "inherit", outline: "none",
}
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "#6B6760", display: "block", marginBottom: 4 }

export default function Dashboard({ clientId, clientName, metrics: rawMetricsProp, contracts, goal, initialStatus, initialStartDate, initialEndDate }: Props) {
  const router = useRouter()
  const [range, setRange] = useState<3 | 6 | 12>(3)
  const [selectedCard, setSelectedCard] = useState<CardKey>("contractMRR")
  const [editOpen, setEditOpen] = useState(false)
  const [status, setStatus] = useState<ClientStatus>(initialStatus ?? "active")
  const [startDate, setStartDate] = useState(initialStartDate ?? "")
  const [endDate, setEndDate] = useState(initialEndDate ?? "")
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [rawMetrics, setRawMetrics] = useState(rawMetricsProp)
  const [addingMonth, setAddingMonth] = useState(false)
  const [newMonth, setNewMonth] = useState("")
  const [addingMonthSaving, setAddingMonthSaving] = useState(false)
  // Pin metric cards to current month (or most recent past month with data)
  const [cardMonth, setCardMonth] = useState(() => {
    const now = new Date().toISOString().slice(0, 7)
    const pastOrCurrent = rawMetricsProp.filter(m => m.month <= now).sort((a, b) => b.month.localeCompare(a.month))
    return pastOrCurrent[0]?.month ?? rawMetricsProp.sort((a, b) => b.month.localeCompare(a.month))[0]?.month ?? now
  })

  async function handleAddMonth(e: React.FormEvent) {
    e.preventDefault()
    if (!newMonth) return
    setAddingMonthSaving(true)
    await fetch(`/api/clients/${clientId}/metrics/${newMonth}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revenue: 0 }),
    })
    setRawMetrics(prev => {
      if (prev.find(m => m.month === newMonth)) return prev
      return [...prev, { month: newMonth, revenue: 0, totalExpenses: 0, salaries: 0, software: 0, cashInBank: 0, leads: 0, newClients: 0, closeRate: 0, churn: 0 }]
    })
    setAddingMonth(false)
    setNewMonth("")
    setAddingMonthSaving(false)
  }

  async function handleDelete() {
    setDeleting(true)
    await fetch(`/api/clients/${clientId}`, { method: "DELETE" })
    router.push("/clients")
    router.refresh()
  }

  function handleMetricUpdate(month: string, field: string, value: number) {
    setRawMetrics(prev => prev.map(m =>
      m.month === month ? { ...m, [field]: value } : m
    ))
  }

  function handleBulkMetricImport(imported: typeof rawMetrics) {
    setRawMetrics(prev => {
      const byMonth = new Map(prev.map(m => [m.month, m]))
      imported.forEach(m => byMonth.set(m.month, m))
      return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month))
    })
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault()
    setEditSaving(true)
    setEditError(null)
    const res = await fetch(`/api/clients/${clientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, startDate: startDate || null, endDate: endDate || null }),
    })
    setEditSaving(false)
    if (!res.ok) { setEditError("Failed to save"); return }
    setEditOpen(false)
  }

  // Slice to range (last N months) — used for chart sparklines
  const metrics = useMemo(() => {
    const sorted = [...rawMetrics].sort((a, b) => a.month.localeCompare(b.month))
    return sorted.slice(-range).map(derivedMetrics)
  }, [rawMetrics, range])

  // All months sorted+derived — used for card month picker
  const allDerived = useMemo(() =>
    [...rawMetrics].sort((a, b) => a.month.localeCompare(b.month)).map(derivedMetrics),
    [rawMetrics]
  )

  // Metric card values: use cardMonth (or nearest past month with data)
  const latest = useMemo(() => {
    const exact = allDerived.find(m => m.month === cardMonth)
    if (exact) return exact
    return [...allDerived].filter(m => m.month <= cardMonth).at(-1) ?? null
  }, [allDerived, cardMonth])

  const prev = useMemo(() => {
    if (!latest) return null
    return [...allDerived].filter(m => m.month < latest.month).at(-1) ?? null
  }, [allDerived, latest])

  // Contract rows for projections
  const contractRows: ContractRow[] = contracts.map(c => ({
    monthly: c.monthly,
    start: c.start,
    contractedThrough: c.contractedThrough,
    status: c.status as "active" | "potential",
    type: (c.type ?? "retainer") as "retainer" | "oneoff",
  }))

  const nowYM = new Date().toISOString().slice(0, 7)
  const currentYM = latest?.month ?? nowYM

  const projInput: ProjectionInput = {
    contracts: contractRows,
    latestTotalExpenses: latest?.totalExpenses ?? 0,
    latestSalaries: latest?.salaries ?? 0,
    latestSoftware: latest?.software ?? 0,
    currentYM,
  }

  // Contract MRR sparkline over range months
  const contractMRRSparkline = useMemo(() => {
    return Array.from({ length: range }, (_, i) => currentMRR(contractRows, ymAdd(nowYM, i - range + 1)))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contracts, range, nowYM])

  // Build chart points for selected metric
  const chartPoints: ChartPoint[] = useMemo(() => {
    // Contract MRR view
    if (selectedCard === "contractMRR") {
      const pts: ChartPoint[] = []
      for (let i = range - 1; i >= 0; i--) {
        const ym = ymAdd(nowYM, -i)
        pts.push({ label: ymLabel(ym), value: currentMRR(contractRows, ym) })
      }
      for (let j = 1; j <= 6; j++) {
        const ym = ymAdd(nowYM, j)
        pts.push({ label: ymLabel(ym), value: currentMRR(contractRows, ym), projected: true })
      }
      return pts
    }

    // If no monthly data but contracts exist, show contract MRR timeline
    if (metrics.length === 0 && contractRows.length > 0) {
      const earliest = contractRows.map(c => c.start).reduce((a, b) => a < b ? a : b)
      const pts: ChartPoint[] = []
      let ym = earliest
      let i = 0
      while (ym <= nowYM && i < 60) {
        pts.push({ label: ymLabel(ym), value: currentMRR(contractRows, ym) })
        ym = ymAdd(ym, 1)
        i++
      }
      for (let j = 1; j <= 6; j++) {
        const fym = ymAdd(nowYM, j)
        pts.push({ label: ymLabel(fym), value: currentMRR(contractRows, fym), projected: true })
      }
      return pts
    }

    const pts: ChartPoint[] = []

    // Fill earlier months with contract MRR when we have fewer months than the range
    if (selectedCard === "revenue" && contractRows.length > 0 && metrics.length < range) {
      const firstMonth = metrics[0]?.month ?? nowYM
      const gap = range - metrics.length
      for (let i = gap; i >= 1; i--) {
        const ym = ymAdd(firstMonth, -i)
        pts.push({ label: ymLabel(ym), value: currentMRR(contractRows, ym), projected: true })
      }
    }

    // Actual months — for revenue, use contract MRR when value is 0 (empty month)
    const hist: ChartPoint[] = metrics.map(m => {
      const val = m[selectedCard] as number
      if (selectedCard === "revenue" && val === 0 && contractRows.length > 0)
        return { label: ymLabel(m.month), value: currentMRR(contractRows, m.month), projected: true }
      return { label: ymLabel(m.month), value: val }
    })
    pts.push(...hist)

    const card = CARDS.find(c => c.key === selectedCard)
    if (!card?.projectable || !currentYM) return pts

    const projValues = projectMetric(selectedCard as ProjectableMetric, projInput)
    const projPts: ChartPoint[] = projValues.map((v, i) => ({
      label: ymLabel(ymAdd(currentYM, i + 1)),
      value: v,
      projected: true,
    }))

    return [...pts, ...projPts]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metrics, selectedCard, contracts])

  // Second series: contracted + potential (only when contractMRR card selected)
  const chartPoints2: ChartPoint[] | undefined = useMemo(() => {
    if (selectedCard !== "contractMRR") return undefined
    const pts: ChartPoint[] = []
    for (let i = range - 1; i >= 0; i--) {
      const ym = ymAdd(nowYM, -i)
      pts.push({ label: ymLabel(ym), value: bookedActive(contractRows, ym) + bookedPotential(contractRows, ym) })
    }
    for (let j = 1; j <= 6; j++) {
      const ym = ymAdd(nowYM, j)
      pts.push({ label: ymLabel(ym), value: bookedActive(contractRows, ym) + bookedPotential(contractRows, ym), projected: true })
    }
    return pts
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCard, contracts, range, nowYM])

  // Goals
  const mrr = currentMRR(contractRows, currentYM)
  const booked = bookedAhead(contractRows, currentYM)
  const mrrTarget = goal ? mrrGoal(goal.annualRevenue) : 0
  const mrrPct = goal ? goalProgress(mrr, mrrTarget) : 0
  const npPct = goal && latest
    ? goalProgress(latest.netProfit, goal.profit)
    : 0

  return (
    <div>
      {/* Edit Client Modal */}
      {editOpen && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={e => { if (e.target === e.currentTarget) setEditOpen(false) }}
        >
          <div style={{ background: "#fff", borderRadius: 14, padding: 28, width: 420, boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
            <h2 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 22, fontWeight: 600, margin: "0 0 20px", color: "#1A1916" }}>
              Edit Client
            </h2>
            <form onSubmit={handleEditSave} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={labelStyle}>Status</label>
                <select style={inputStyle} value={status} onChange={e => {
                  const next = e.target.value as ClientStatus
                  setStatus(next)
                  if (next === "active" && !startDate) setStartDate(new Date().toISOString().slice(0, 10))
                }}>
                  <option value="potential">Potential</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Start Date</label>
                  <input style={inputStyle} type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>End Date</label>
                  <input style={inputStyle} type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
              </div>
              {editError && <div style={{ fontSize: 13, color: "#C2410C" }}>{editError}</div>}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                <button type="button" onClick={() => setEditOpen(false)}
                  style={{ padding: "8px 16px", background: "none", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 13, cursor: "pointer", color: "#6B6760" }}>
                  Cancel
                </button>
                <button type="submit" disabled={editSaving}
                  style={{ padding: "8px 18px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: editSaving ? "default" : "pointer", opacity: editSaving ? 0.7 : 1 }}>
                  {editSaving ? "Saving…" : "Save"}
                </button>
              </div>

              {/* Delete zone */}
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #ECE7DE" }}>
                {confirmDelete ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 13, color: "#6B6760", flex: 1 }}>
                      Permanently delete <strong>{clientName}</strong> and all their data?
                    </span>
                    <button type="button" onClick={() => setConfirmDelete(false)}
                      style={{ padding: "6px 12px", background: "none", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 12, cursor: "pointer", color: "#6B6760" }}>
                      No, keep
                    </button>
                    <button type="button" onClick={handleDelete} disabled={deleting}
                      style={{ padding: "6px 14px", background: "#DC2626", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: deleting ? "default" : "pointer", opacity: deleting ? 0.7 : 1 }}>
                      {deleting ? "Deleting…" : "Yes, delete"}
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setConfirmDelete(true)}
                    style={{ background: "none", border: "none", fontSize: 12, color: "#9C9590", cursor: "pointer", padding: 0, textDecoration: "underline" }}>
                    Delete this client
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 28, fontWeight: 600, color: "#1A1916", margin: 0 }}>
            {clientName}
          </h1>
          {initialStatus !== undefined && (
            <button
              onClick={() => setEditOpen(true)}
              style={{ padding: "4px 12px", background: "none", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 12, color: "#6B6760", cursor: "pointer" }}
            >
              Edit
            </button>
          )}
          {initialStatus !== undefined && <span style={{
            fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 99,
            background: STATUS_COLORS[status].bg, color: STATUS_COLORS[status].text,
            textTransform: "uppercase", letterSpacing: "0.04em",
          }}>
            {status}
          </span>}
        </div>
        <div style={{ display: "flex", gap: 2, background: "#F0EDE8", borderRadius: 7, padding: 3 }}>
          {([3, 6, 12] as const).map(n => (
            <button
              key={n}
              onClick={() => setRange(n)}
              style={{
                padding: "4px 14px",
                borderRadius: 5,
                border: "none",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                background: range === n ? "#fff" : "transparent",
                color: range === n ? "#1A1916" : "#9C9590",
                boxShadow: range === n ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}
            >
              {n}M
            </button>
          ))}
        </div>
      </div>

      {/* Chart — full width, at top */}
      <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 24, marginBottom: 24 }}>
        <MetricChart
          points={chartPoints}
          series2={chartPoints2}
          series2Label="With Potential"
          format={selectedCard === "contractMRR" ? "currency" : (CARDS.find(c => c.key === selectedCard)?.fmt ?? "currency")}
          label={selectedCard === "contractMRR" ? "Contracted MRR" : rawMetrics.length === 0 && contractRows.length > 0 ? "Contract MRR" : (CARDS.find(c => c.key === selectedCard)?.label ?? "")}
        />
      </div>

      {/* Metric Cards */}
      {allDerived.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: "#9C9590", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Showing
          </span>
          <select
            value={cardMonth}
            onChange={e => setCardMonth(e.target.value)}
            style={{ fontSize: 12, color: "#1A1916", border: "1px solid #ECE7DE", borderRadius: 6, padding: "3px 8px", background: "#fff", fontFamily: "inherit", cursor: "pointer", outline: "none" }}
          >
            {[...allDerived].sort((a, b) => b.month.localeCompare(a.month)).map(m => (
              <option key={m.month} value={m.month}>{ymLabel(m.month)}{m.month === nowYM ? " (current)" : m.month > nowYM ? " (future)" : ""}</option>
            ))}
          </select>
          {latest && latest.month !== cardMonth && (
            <span style={{ fontSize: 11, color: "#9C9590" }}>→ showing {ymLabel(latest.month)}</span>
          )}
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 24 }}>
        <MetricCard
          label="Contracted MRR"
          value={fmtCurrency(currentMRR(contractRows, nowYM))}
          delta={contractMRRSparkline.length >= 2 ? momDelta(contractMRRSparkline[contractMRRSparkline.length - 1], contractMRRSparkline[contractMRRSparkline.length - 2]) : null}
          sparkline={contractMRRSparkline}
          selected={selectedCard === "contractMRR"}
          onClick={() => setSelectedCard("contractMRR")}
        />
        {CARDS.map(card => {
          const val = latest ? (latest[card.key] as number) : 0
          const prevVal = prev ? (prev[card.key] as number) : null
          const delta = prevVal !== null ? momDelta(val, prevVal) : null
          const sparkline = metrics.map(m => m[card.key] as number)
          return (
            <MetricCard
              key={card.key}
              label={card.label}
              value={fmtValue(val, card.fmt)}
              delta={delta}
              sparkline={sparkline}
              selected={selectedCard === card.key}
              onClick={() => setSelectedCard(card.key)}
            />
          )
        })}
      </div>

      {/* Goals Panel — full width below chart */}
      {goal && (
        <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#9C9590", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 16 }}>
            Goals
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24 }}>
            <GoalItem label="Monthly Revenue" current={mrr} target={mrrTarget} pct={mrrPct} fmt="currency" />
            <GoalItem label="Net Profit / Mo" current={latest?.netProfit ?? 0} target={goal.profit / 12} pct={npPct} fmt="currency" />
            <div>
              <div style={{ fontSize: 11, color: "#9C9590", marginBottom: 4 }}>Booked ahead</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#1A1916", fontVariantNumeric: "tabular-nums" }}>{fmtCurrency(booked)}</div>
              <div style={{ fontSize: 11, color: "#9C9590", marginTop: 2 }}>in active contracts</div>
            </div>
          </div>
        </div>
      )}

      {/* Month Table */}
      <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1916" }}>Monthly Metrics</div>
          {addingMonth ? (
            <form onSubmit={handleAddMonth} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="month"
                value={newMonth}
                onChange={e => setNewMonth(e.target.value)}
                required
                autoFocus
                style={{ padding: "5px 8px", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 13, fontFamily: "inherit", outline: "none" }}
              />
              <button type="submit" disabled={addingMonthSaving}
                style={{ padding: "5px 14px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                {addingMonthSaving ? "…" : "Add"}
              </button>
              <button type="button" onClick={() => setAddingMonth(false)}
                style={{ padding: "5px 10px", background: "none", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 12, cursor: "pointer", color: "#6B6760" }}>
                Cancel
              </button>
            </form>
          ) : (
            <button onClick={() => setAddingMonth(true)}
              style={{ padding: "5px 14px", background: "none", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#6B6760" }}>
              + Add Month
            </button>
          )}
        </div>
        <MonthTable
          key={rawMetrics.length}
          clientId={clientId}
          months={[...rawMetrics].sort((a, b) => a.month.localeCompare(b.month)).slice(-range)}
          onUpdate={handleMetricUpdate}
          onBulkImport={handleBulkMetricImport}
        />
      </div>
    </div>
  )
}

function GoalItem({ label, current, target, pct, fmt }: { label: string; current: number; target: number; pct: number; fmt: "currency" | "percent" | "number" }) {
  const f = (v: number) => fmt === "currency" ? fmtCurrency(v) : fmtPercent(v)
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 11, color: "#6B6760" }}>
        <span>{label}</span>
        <span style={{ fontWeight: 600, color: "#1A1916", fontVariantNumeric: "tabular-nums" }}>
          {f(current)} / {f(target)}
        </span>
      </div>
      <div style={{ height: 6, background: "#ECE7DE", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: pct >= 100 ? "#1F7A4D" : "#E9532A", borderRadius: 3, transition: "width 0.4s" }} />
      </div>
      <div style={{ fontSize: 10, color: pct >= 100 ? "#1F7A4D" : "#9C9590", marginTop: 3, textAlign: "right" }}>
        {Math.round(pct)}%
      </div>
    </div>
  )
}
