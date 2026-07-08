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

interface Props {
  clientId: string
  clientName: string
  metrics: Metric[]
  contracts: Contract[]
  goal: Goal | null
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

export default function Dashboard({ clientId, clientName, metrics: rawMetrics, contracts, goal }: Props) {
  const [range, setRange] = useState<6 | 12>(6)
  const [selectedCard, setSelectedCard] = useState<CardKey>("revenue")

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

  const currentYM = latest?.month ?? ""

  const projInput: ProjectionInput = {
    contracts: contractRows,
    latestTotalExpenses: latest?.totalExpenses ?? 0,
    latestSalaries: latest?.salaries ?? 0,
    latestSoftware: latest?.software ?? 0,
    currentYM,
  }

  // Build chart points for selected metric
  const chartPoints: ChartPoint[] = useMemo(() => {
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
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 28, fontWeight: 600, color: "#1A1916", margin: 0 }}>
          {clientName}
        </h1>
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
            format={CARDS.find(c => c.key === selectedCard)?.fmt ?? "number"}
            label={CARDS.find(c => c.key === selectedCard)?.label ?? ""}
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
