"use client"
import { useState, useMemo } from "react"
import MetricCard from "./MetricCard"
import MetricChart, { ChartPoint } from "./MetricChart"
import MonthTable from "./MonthTable"
import {
  netProfit, grossProfit, netMargin, momDelta, fmtCurrency, fmtPercent,
  projectMetric, ymAdd, ymLabel, currentMRR, bookedAhead,
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

type CardKey = "revenue" | "netProfit" | "grossProfit" | "netMargin" | "leads" | "closeRate" | "newClients" | "churn"

const CARDS: { key: CardKey; label: string; fmt: "currency" | "percent" | "number"; projectable?: boolean }[] = [
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

export default function Dashboard({ clientId, clientName, metrics: rawMetrics, contracts, goal, initialStatus, initialStartDate, initialEndDate }: Props) {
  const [range, setRange] = useState<6 | 12>(6)
  const [selectedCard, setSelectedCard] = useState<CardKey>("revenue")
  const [editOpen, setEditOpen] = useState(false)
  const [status, setStatus] = useState<ClientStatus>(initialStatus ?? "active")
  const [startDate, setStartDate] = useState(initialStartDate ?? "")
  const [endDate, setEndDate] = useState(initialEndDate ?? "")
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

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

  // Slice to range (last N months)
  const metrics = useMemo(() => {
    const sorted = [...rawMetrics].sort((a, b) => a.month.localeCompare(b.month))
    return sorted.slice(-range).map(derivedMetrics)
  }, [rawMetrics, range])

  const latest = metrics[metrics.length - 1]
  const prev = metrics[metrics.length - 2]

  // Contract rows for projections
  const contractRows: ContractRow[] = contracts.map(c => ({
    monthly: c.monthly,
    start: c.start,
    contractedThrough: c.contractedThrough,
    status: c.status as "active" | "potential",
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

  // Build chart points for selected metric
  const chartPoints: ChartPoint[] = useMemo(() => {
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

    const hist: ChartPoint[] = metrics.map(m => ({
      label: ymLabel(m.month),
      value: m[selectedCard] as number,
    }))

    const card = CARDS.find(c => c.key === selectedCard)
    if (!card?.projectable || !currentYM) return hist

    const projValues = projectMetric(selectedCard as ProjectableMetric, projInput)
    const projPts: ChartPoint[] = projValues.map((v, i) => ({
      label: ymLabel(ymAdd(currentYM, i + 1)),
      value: v,
      projected: true,
    }))

    return [...hist, ...projPts]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metrics, selectedCard, contracts])

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
                <select style={inputStyle} value={status} onChange={e => setStatus(e.target.value as ClientStatus)}>
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
          {([6, 12] as const).map(n => (
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

      {/* Metric Cards */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 24 }}>
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

      {/* Chart + Goals */}
      <div style={{ display: "flex", gap: 20, marginBottom: 24, alignItems: "flex-start" }}>
        {/* Chart */}
        <div style={{ flex: 1, background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 24 }}>
          <MetricChart
            points={chartPoints}
            format="currency"
            label={rawMetrics.length === 0 && contractRows.length > 0 ? "Contract MRR" : (CARDS.find(c => c.key === selectedCard)?.label ?? "")}
          />
        </div>

        {/* Goals Panel */}
        {goal && (
          <div style={{ width: 240, flexShrink: 0, background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#9C9590", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 16 }}>
              Goals
            </div>

            <GoalItem
              label="Monthly Revenue"
              current={mrr}
              target={mrrTarget}
              pct={mrrPct}
              fmt="currency"
            />

            <GoalItem
              label="Net Profit / Mo"
              current={latest?.netProfit ?? 0}
              target={goal.profit / 12}
              pct={npPct}
              fmt="currency"
            />

            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #ECE7DE" }}>
              <div style={{ fontSize: 11, color: "#9C9590", marginBottom: 4 }}>Booked ahead</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#1A1916", fontVariantNumeric: "tabular-nums" }}>
                {fmtCurrency(booked)}
              </div>
              <div style={{ fontSize: 11, color: "#9C9590", marginTop: 2 }}>in active contracts</div>
            </div>
          </div>
        )}
      </div>

      {/* Month Table */}
      <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1916", marginBottom: 14 }}>Monthly Metrics</div>
        <MonthTable
          clientId={clientId}
          months={rawMetrics.sort((a, b) => a.month.localeCompare(b.month)).slice(-range)}
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
