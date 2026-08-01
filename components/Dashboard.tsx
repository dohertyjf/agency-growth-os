"use client"
import { useState, useMemo } from "react"
import { useFmtCurrency, useCurrency } from "@/lib/CurrencyContext"
import { useRouter } from "next/navigation"
import MetricCard from "./MetricCard"
import MetricChart, { ChartPoint, FlowBars } from "./MetricChart"
import MonthTable, { BulkMetricsModal } from "./MonthTable"
import GrowthProjection from "./GrowthProjection"
import {
  netProfit, grossProfit, netMargin, momDelta, fmtCurrency, fmtPercent,
  projectMetric, ymAdd, ymLabel, currentMRR, bookedActive, bookedPotential, bookedOpportunity, bookedAhead,
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
  marketingSpend: number
}

interface Contract {
  id: string
  name: string
  monthly: number
  hoursPerMonth?: number
  start: string
  contractedThrough: string | null
  status: string
  type?: string
}

interface Goal {
  annualRevenue: number
  profit: number
  monthlyRevenue: number
  netProfitPct: number
  closeRatePct: number
}

interface Payment {
  contractId: string
  month: string
  amount: number
}

type ClientStatus = "potential" | "active" | "paused"

interface Props {
  clientId: string
  projectionState?: string | null
  clientSlug: string
  clientName: string
  totalCapacityHours?: number
  totalHoursWorked?: number
  payrollByMonth?: Map<string, number>
  metrics: Metric[]
  contracts: Contract[]
  goal: Goal | null
  payments?: Payment[]
  initialStatus?: ClientStatus
  initialStartDate?: string | null
  initialEndDate?: string | null
}

type MetricKey = "revenue" | "netProfit" | "grossProfit" | "netMargin" | "leads" | "closeRate" | "newClients" | "churn" | "peopleCostPct"
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
  { key: "peopleCostPct", label: "People Cost %", fmt: "percent" },
]

function derivedMetrics(m: Metric, payroll = 0) {
  return {
    ...m,
    grossProfit: grossProfit(m.revenue, m.salaries),
    netProfit: netProfit(m.revenue, m.totalExpenses),
    netMargin: netMargin(m.revenue, m.totalExpenses),
    closeRate: m.leads > 0 ? (m.newClients / m.leads) * 100 : 0,
    peopleCostPct: payroll > 0 && m.revenue > 0 ? (payroll / m.revenue) * 100 : 0,
    marketingSpend: m.marketingSpend ?? 0,
  }
}

function fmtValue(v: number, fmt: "currency" | "percent" | "number", currency = "USD"): string {
  if (fmt === "currency") return fmtCurrency(v, currency)
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

export default function Dashboard({ clientId, projectionState, clientSlug, clientName, metrics: rawMetricsProp, contracts, goal, payments: paymentsProp, initialStatus, initialStartDate, initialEndDate, totalCapacityHours = 0, totalHoursWorked = 0, payrollByMonth }: Props) {
  const router = useRouter()
  const fmt$ = useFmtCurrency()
  const currency = useCurrency()
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
  const [bulkMetricsOpen, setBulkMetricsOpen] = useState(false)
  const [tableRange, setTableRange] = useState<3 | 6 | 12 | "all">("all")
  const [showMRRFlow, setShowMRRFlow] = useState(false)
  const [showCashCollected, setShowCashCollected] = useState(false)
  const [payments, setPayments] = useState<Payment[]>(paymentsProp ?? [])
  const [newMonth, setNewMonth] = useState("")
  const [addingMonthSaving, setAddingMonthSaving] = useState(false)
  const [currentGoal] = useState(goal)
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
      return [...prev, { month: newMonth, revenue: 0, totalExpenses: 0, salaries: 0, software: 0, cashInBank: 0, leads: 0, newClients: 0, closeRate: 0, churn: 0, marketingSpend: 0 }]
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

  function handlePaymentsChange(updated: Payment[]) {
    setPayments(updated)
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
    return sorted.slice(-range).map(m => derivedMetrics(m, payrollByMonth?.get(m.month) ?? 0))
  }, [rawMetrics, range, payrollByMonth])

  // All months sorted+derived — used for card month picker
  const allDerived = useMemo(() =>
    [...rawMetrics].sort((a, b) => a.month.localeCompare(b.month)).map(m => derivedMetrics(m, payrollByMonth?.get(m.month) ?? 0)),
    [rawMetrics, payrollByMonth]
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

  // Contract MRR sparkline over range months, ending at the selected month
  const contractMRRSparkline = useMemo(() => {
    return Array.from({ length: range }, (_, i) => currentMRR(contractRows, ymAdd(cardMonth, i - range + 1)))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contracts, range, cardMonth])

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

  // Third funnel line: contracted + qualified + opportunity (contractMRR card only)
  const chartPoints4: ChartPoint[] | undefined = useMemo(() => {
    if (selectedCard !== "contractMRR") return undefined
    const withOpp = (ym: string) => bookedActive(contractRows, ym) + bookedPotential(contractRows, ym) + bookedOpportunity(contractRows, ym)
    const pts: ChartPoint[] = []
    for (let i = range - 1; i >= 0; i--) { const ym = ymAdd(nowYM, -i); pts.push({ label: ymLabel(ym), value: withOpp(ym) }) }
    for (let j = 1; j <= 6; j++) { const ym = ymAdd(nowYM, j); pts.push({ label: ymLabel(ym), value: withOpp(ym), projected: true }) }
    return pts
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCard, contracts, range, nowYM])

  // New vs churned MRR flow bars
  const flowBars: FlowBars | undefined = useMemo(() => {
    if (!showMRRFlow) return undefined
    const retainers = contractRows.filter(c => c.type !== "oneoff")
    const months: string[] = []
    for (let i = range - 1; i >= 0; i--) months.push(ymAdd(nowYM, -i))
    const newRevenue = months.map(m =>
      contracts.filter(c => c.start === m && c.status !== "potential" && c.type !== "oneoff")
               .reduce((s, c) => s + c.monthly, 0)
    )
    const churnedRevenue = months.map(m =>
      contracts.filter(c => c.contractedThrough !== null && c.contractedThrough === m && c.status !== "potential" && c.type !== "oneoff")
               .reduce((s, c) => s + c.monthly, 0)
    )
    void retainers
    return { newRevenue, churnedRevenue }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMRRFlow, contracts, range, nowYM])

  // Cash collected per month: explicit payments if entered, otherwise default to MRR.
  // Projects 6 months forward like the MRR lines, so future payment schedules that
  // differ from MRR (deposits, milestone billing, late pay) show as a diverging line.
  // Restricted to signed (active/finished) work — speculative schedules stay out.
  const cashCollectedPoints: ChartPoint[] | undefined = useMemo(() => {
    if (!showCashCollected) return undefined
    const signedIds = new Set(contracts.filter(c => c.status === "active" || c.status === "finished").map(c => c.id))
    const paymentByMonth = new Map<string, number>()
    payments.forEach(p => { if (signedIds.has(p.contractId)) paymentByMonth.set(p.month, (paymentByMonth.get(p.month) ?? 0) + p.amount) })
    const mrrByMonth = new Map(rawMetrics.map(m => [m.month, m.revenue]))
    const pts: ChartPoint[] = []
    for (let i = range - 1; i >= 0; i--) {
      const ym = ymAdd(nowYM, -i)
      const explicit = paymentByMonth.get(ym)
      const value = explicit !== undefined ? explicit : (mrrByMonth.get(ym) ?? currentMRR(contractRows, ym))
      pts.push({ label: ymLabel(ym), value })
    }
    for (let j = 1; j <= 6; j++) {
      const ym = ymAdd(nowYM, j)
      const explicit = paymentByMonth.get(ym)
      const value = explicit !== undefined ? explicit : currentMRR(contractRows, ym)
      pts.push({ label: ymLabel(ym), value, projected: true })
    }
    return pts
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCashCollected, payments, rawMetrics, contractRows, contracts, range, nowYM])

  // Goals
  const mrr = currentMRR(contractRows, currentYM)
  const booked = bookedAhead(contractRows, currentYM)
  const mrrTarget = currentGoal
    ? (currentGoal.monthlyRevenue > 0 ? currentGoal.monthlyRevenue : mrrGoal(currentGoal.annualRevenue))
    : 0
  const mrrPct = currentGoal && mrrTarget > 0 ? goalProgress(mrr, mrrTarget) : 0
  const monthlyProfitTarget = currentGoal
    ? (currentGoal.netProfitPct > 0 && mrrTarget > 0
      ? mrrTarget * (currentGoal.netProfitPct / 100)
      : currentGoal.profit / 12)
    : 0
  const npPct = currentGoal && latest && monthlyProfitTarget > 0
    ? goalProgress(latest.netProfit, monthlyProfitTarget)
    : 0
  const activeContracts = contracts.filter(c => c.status === "active")
  const avgContractSize = activeContracts.length
    ? activeContracts.reduce((s, c) => s + c.monthly, 0) / activeContracts.length
    : 0
  const activeClientCount = activeContracts.length
  const avgContractHours = activeContracts.length
    ? activeContracts.reduce((s, c) => s + (c.hoursPerMonth ?? 0), 0) / activeContracts.length
    : 0

  // Avg Client Monthly Value: reported revenue / active contracts (falls back to contract MRR)
  const revenueForACMV = (latest?.revenue ?? 0) > 0 ? latest!.revenue : currentMRR(contractRows, nowYM)
  const acmv = activeClientCount > 0 ? revenueForACMV / activeClientCount : 0

  // Avg Client Lifetime Value: ACMV × avg contract duration in months
  function monthsBetween(a: string, b: string) {
    const [ay, am] = a.split("-").map(Number)
    const [by, bm] = b.split("-").map(Number)
    return Math.max(1, (by - ay) * 12 + (bm - am) + 1)
  }
  const billableContracts = contracts.filter(c => c.type !== "oneoff")
  const avgDurationMonths = billableContracts.length
    ? billableContracts.reduce((s, c) => s + monthsBetween(c.start, c.contractedThrough ?? nowYM), 0) / billableContracts.length
    : 0
  const acltv = acmv * avgDurationMonths

  const totalActiveHours = activeContracts.reduce((s, c) => s + (c.hoursPerMonth ?? 0), 0)
  const hourlyYield = totalHoursWorked > 0 && revenueForACMV > 0
    ? revenueForACMV / totalHoursWorked
    : 0

  const cacMonths = allDerived.filter(m => (m.marketingSpend ?? 0) > 0 || m.newClients > 0).slice(-6)
  const cacTotalSpend = cacMonths.reduce((s, m) => s + (m.marketingSpend ?? 0), 0)
  const cacTotalNewClients = cacMonths.reduce((s, m) => s + m.newClients, 0)
  const cac = cacTotalSpend > 0 && cacTotalNewClients > 0 ? cacTotalSpend / cacTotalNewClients : 0

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
                  <option value="potential">Qualified</option>
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
          series2Label="With Qualified"
          series3={cashCollectedPoints}
          series3Label="Cash Collected"
          series4={chartPoints4}
          series4Label="With Opportunity"
          format={selectedCard === "contractMRR" ? "currency" : (CARDS.find(c => c.key === selectedCard)?.fmt ?? "currency")}
          label={selectedCard === "contractMRR" ? "Contracted MRR" : rawMetrics.length === 0 && contractRows.length > 0 ? "Contract MRR" : (CARDS.find(c => c.key === selectedCard)?.label ?? "")}
          flowBars={flowBars}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
          <button
            onClick={() => setShowCashCollected(v => !v)}
            style={{
              padding: "4px 12px", fontSize: 11, fontWeight: 600, borderRadius: 20, cursor: "pointer", border: "1px solid",
              background: showCashCollected ? "#F0FDFA" : "transparent",
              borderColor: showCashCollected ? "#0D9488" : "#ECE7DE",
              color: showCashCollected ? "#0F766E" : "#9C9590",
            }}
          >
            {showCashCollected ? "● Cash Collected" : "○ Cash Collected"}
          </button>
          <button
            onClick={() => setShowMRRFlow(v => !v)}
            style={{
              padding: "4px 12px", fontSize: 11, fontWeight: 600, borderRadius: 20, cursor: "pointer", border: "1px solid",
              background: showMRRFlow ? "#F0FDF4" : "transparent",
              borderColor: showMRRFlow ? "#22C55E" : "#ECE7DE",
              color: showMRRFlow ? "#166534" : "#9C9590",
            }}
          >
            {showMRRFlow ? "● MRR Flow" : "○ MRR Flow"}
          </button>
        </div>
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
          value={fmt$(currentMRR(contractRows, cardMonth))}
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
              value={fmtValue(val, card.fmt, currency)}
              delta={delta}
              sparkline={sparkline}
              selected={selectedCard === card.key}
              onClick={() => setSelectedCard(card.key)}
            />
          )
        })}
        {acmv > 0 && (
          <InsightCard
            label="Avg Client / Mo"
            value={fmt$(acmv)}
            sub={`${activeClientCount} active client${activeClientCount === 1 ? "" : "s"}`}
          />
        )}
        {acltv > 0 && (
          <InsightCard
            label="Avg Client Lifetime"
            value={fmt$(acltv)}
            sub={`~${Math.round(avgDurationMonths)} mo avg length`}
          />
        )}
        {hourlyYield > 0 && (
          <InsightCard
            label="Hourly Yield"
            value={fmt$(Math.round(hourlyYield))}
            sub={`${totalHoursWorked} hrs worked/mo`}
          />
        )}
        {cac > 0 && (
          <InsightCard
            label="CAC"
            value={fmt$(Math.round(cac))}
            sub={`per new client · ${cacMonths.length}mo avg`}
          />
        )}
      </div>

      {/* Goals Panel */}
      <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#9C9590", letterSpacing: "0.05em", textTransform: "uppercase" }}>Goals</div>
          <a href={`/clients/${clientSlug}/goals`}
            style={{ fontSize: 11, color: "#9C9590", textDecoration: "none", border: "1px solid #ECE7DE", borderRadius: 5, padding: "3px 10px" }}>
            {currentGoal && mrrTarget > 0 ? "Edit goals" : "Set goals"}
          </a>
        </div>
        {currentGoal && mrrTarget > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24 }}>
            <GoalItem label="Monthly Revenue" current={mrr} target={mrrTarget} pct={mrrPct} fmt="currency" />
            <GoalItem label="Net Profit / Mo" current={latest?.netProfit ?? 0} target={monthlyProfitTarget} pct={npPct} fmt="currency" />
            <div>
              <div style={{ fontSize: 11, color: "#9C9590", marginBottom: 4 }}>Booked ahead</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#1A1916", fontVariantNumeric: "tabular-nums" }}>{fmt$(booked)}</div>
              <div style={{ fontSize: 11, color: "#9C9590", marginTop: 2 }}>in active contracts</div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "#9C9590" }}>
            No goals set yet. <a href={`/clients/${clientSlug}/goals`} style={{ color: "#E9532A", textDecoration: "none" }}>Set goals →</a>
          </div>
        )}
      </div>

      {/* Growth Projection */}
      <GrowthProjection
        metrics={rawMetrics}
        startMRR={mrr}
        avgContractSize={avgContractSize}
        goalMRR={currentGoal ? mrrTarget : null}
        totalCapacityHours={totalCapacityHours}
        avgContractHours={avgContractHours}
        activeClientCount={activeClientCount}
        clientId={clientId}
        savedProjection={(() => { try { return projectionState ? JSON.parse(projectionState) : null } catch { return null } })()}
      />

      {/* Month Table */}
      <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1916" }}>Monthly Metrics</div>
            <div style={{ display: "flex", background: "#F5F1EC", borderRadius: 6, padding: 2, gap: 1 }}>
              {([3, 6, 12, "all"] as const).map(n => (
                <button key={n} onClick={() => setTableRange(n)}
                  style={{ padding: "2px 8px", fontSize: 11, fontWeight: 600, border: "none", borderRadius: 4, cursor: "pointer", background: tableRange === n ? "#fff" : "transparent", color: tableRange === n ? "#1A1916" : "#9C9590", boxShadow: tableRange === n ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
                  {n === "all" ? "All" : `${n}mo`}
                </button>
              ))}
            </div>
          </div>
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
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setBulkMetricsOpen(true)}
                style={{ padding: "5px 14px", background: "none", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#6B6760" }}>
                Bulk Import
              </button>
              <button onClick={() => setAddingMonth(true)}
                style={{ padding: "5px 14px", background: "none", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#6B6760" }}>
                + Add Month
              </button>
            </div>
          )}
          {bulkMetricsOpen && (
            <BulkMetricsModal
              clientId={clientId}
              onClose={() => setBulkMetricsOpen(false)}
              onImport={rows => { handleBulkMetricImport(rows); setBulkMetricsOpen(false) }}
            />
          )}
        </div>
        <MonthTable
          key={rawMetrics.length}
          clientId={clientId}
          months={[...rawMetrics].sort((a, b) => a.month.localeCompare(b.month)).slice(tableRange === "all" ? 0 : -tableRange)}
          onUpdate={handleMetricUpdate}
          onBulkImport={handleBulkMetricImport}
        />
      </div>
    </div>
  )
}

function InsightCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{
      flex: "1 1 150px", minWidth: 130,
      background: "#FBFAF7", border: "1.5px solid #ECE7DE", borderRadius: 10, padding: "14px 16px",
    }}>
      <div style={{ fontSize: 11, color: "#9C9590", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 21, fontWeight: 700, color: "#1A1916", fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: "#9C9590", marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

function GoalItem({ label, current, target, pct, fmt }: { label: string; current: number; target: number; pct: number; fmt: "currency" | "percent" | "number" }) {
  const fmt$ = useFmtCurrency()
  const f = (v: number) => fmt === "currency" ? fmt$(v) : fmtPercent(v)
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
