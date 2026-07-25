"use client"
import { useState, useMemo } from "react"
import { ymAdd, ymLabel } from "@/lib/calc"
import { useFmtCurrency, useCurrency } from "@/lib/CurrencyContext"

function currSym(c: string) { return c === "GBP" ? "£" : c === "EUR" ? "€" : "$" }

function fmtAxis(v: number, sym: string): string {
  if (Math.abs(v) >= 100000) return sym + Math.round(v / 1000) + "k"
  if (Math.abs(v) >= 10000) return sym + (Math.round(v / 100) / 10) + "k"
  return sym + Math.round(v).toLocaleString()
}

interface Metric {
  month: string
  leads: number
  closeRate: number
  churn: number
  newClients: number
}

interface Props {
  metrics: Metric[]
  startMRR: number
  avgContractSize: number
  goalMRR: number | null
  totalCapacityHours: number
  avgContractHours: number
  activeClientCount: number
}

function avg(nums: number[]): number {
  if (!nums.length) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function round1(n: number) { return Math.round(n * 10) / 10 }

function projectMRR(
  startMRR: number, leads: number, closeRate: number,
  avgDeal: number, churnCount: number, months: number,
  cap?: number
): number[] {
  const result: number[] = []
  let mrr = startMRR
  for (let i = 0; i < months; i++) {
    const newMRR = leads * (closeRate / 100) * avgDeal
    const churnedMRR = churnCount * avgDeal
    mrr = Math.max(0, mrr + newMRR - churnedMRR)
    if (cap !== undefined) mrr = Math.min(mrr, cap)
    result.push(Math.round(mrr))
  }
  return result
}

const inputStyle: React.CSSProperties = {
  padding: "6px 10px", border: "1px solid #ECE7DE", borderRadius: 6,
  fontSize: 13, background: "#fff", color: "#1A1916",
  width: "100%", boxSizing: "border-box", fontFamily: "inherit", outline: "none",
}

export default function GrowthProjection({ metrics, startMRR, avgContractSize, goalMRR, totalCapacityHours, avgContractHours, activeClientCount }: Props) {
  const now = useMemo(() => new Date().toISOString().slice(0, 7), [])
  const fmt$ = useFmtCurrency()
  const sym = currSym(useCurrency())
  const [lookback, setLookback] = useState<3 | 6>(6)

  const recentMetrics = useMemo(() => {
    const past = metrics.filter(m => m.month <= now).slice(-lookback)
    return past
  }, [metrics, now, lookback])

  const defaultLeads = useMemo(() => round1(avg(recentMetrics.map(m => m.leads))), [recentMetrics])
  const defaultCloseRate = useMemo(() => {
    const totalLeads = recentMetrics.reduce((s, m) => s + m.leads, 0)
    const totalNewClients = recentMetrics.reduce((s, m) => s + m.newClients, 0)
    return totalLeads > 0 ? round1((totalNewClients / totalLeads) * 100) : 0
  }, [recentMetrics])
  const defaultChurn = useMemo(() => round1(avg(recentMetrics.map(m => m.churn))), [recentMetrics])

  const [leads, setLeads] = useState(defaultLeads)
  const [closeRate, setCloseRate] = useState(defaultCloseRate)
  const [avgDeal, setAvgDeal] = useState(Math.round(avgContractSize))
  const [churn, setChurn] = useState(defaultChurn)
  const [hoursPerClient, setHoursPerClient] = useState(round1(avgContractHours))
  const [billableHours, setBillableHours] = useState(totalCapacityHours || 0)
  const [revenueGoal, setRevenueGoal] = useState(goalMRR ?? 0)

  function reset() {
    setLeads(defaultLeads)
    setCloseRate(defaultCloseRate)
    setAvgDeal(Math.round(avgContractSize))
    setChurn(defaultChurn)
    setHoursPerClient(round1(avgContractHours))
    setBillableHours(totalCapacityHours || 0)
    setRevenueGoal(goalMRR ?? 0)
  }

  // Capacity ceiling: max clients from billable hours → max MRR
  const maxClients = hoursPerClient > 0 && billableHours > 0
    ? Math.floor(billableHours / hoursPerClient)
    : null
  const mrrCap = maxClients !== null && avgDeal > 0 ? maxClients * avgDeal : undefined

  const projected = useMemo(
    () => projectMRR(startMRR, leads, closeRate, avgDeal, churn, 12, mrrCap),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [startMRR, leads, closeRate, avgDeal, churn, mrrCap]
  )

  const monthLabels = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ymLabel(ymAdd(now, i + 1))),
    [now]
  )

  // Month where projection hits the capacity ceiling
  const capacityHitMonth = mrrCap !== undefined
    ? projected.findIndex(v => v >= mrrCap)
    : -1

  const currentHoursUsed = activeClientCount * hoursPerClient
  const hoursAvailable = billableHours - currentHoursUsed
  const slotsAvailable = hoursPerClient > 0 ? Math.floor(hoursAvailable / hoursPerClient) : null

  // Chart — same dimensions and technique as MetricChart
  const allVals = [startMRR, ...projected, revenueGoal, mrrCap ?? 0].filter(v => v > 0)
  const dataMax = allVals.length ? Math.max(...allVals) : 1
  const dataMin = allVals.length ? Math.min(...allVals) : 0
  const spread = dataMax - dataMin || dataMax * 0.15 || 1
  const maxVal = dataMax + spread * 0.2
  const yMin = Math.max(0, dataMin - spread * 0.2)
  const yRange = maxVal - yMin || 1
  const W = 880, H = 240, PL = 60, PR = 24, PT = 20, PB = 36
  const plotW = W - PL - PR
  const plotH = H - PT - PB
  const toX = (i: number) => PL + (i / 11) * plotW
  const toY = (v: number) => PT + plotH - ((v - yMin) / yRange) * plotH
  const yTicks = Array.from({ length: 5 }, (_, i) => yMin + (yRange * i) / 4)

  const pathD = projected.map((v, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(v)}`).join(" ")
  const goalY = revenueGoal > 0 ? toY(revenueGoal) : null
  const capY = mrrCap !== undefined ? toY(mrrCap) : null

  const goalHitMonth = revenueGoal > 0 ? projected.findIndex(v => v >= revenueGoal) : -1

  const newClientsPerMonth = leads * (closeRate / 100)
  const netMRRChange = newClientsPerMonth * avgDeal - churn * avgDeal

  return (
    <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 20, marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1916" }}>Growth Projection</div>
          <div style={{ fontSize: 11, color: "#9C9590", marginTop: 2 }}>
            Based on last {lookback} months · adjust inputs to model scenarios
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <div style={{ display: "flex", background: "#F0EDE8", borderRadius: 6, padding: 2, gap: 1 }}>
            {([3, 6] as const).map(n => (
              <button key={n} onClick={() => setLookback(n)}
                style={{ padding: "3px 10px", fontSize: 11, fontWeight: 600, border: "none", borderRadius: 4, cursor: "pointer", background: lookback === n ? "#fff" : "transparent", color: lookback === n ? "#1A1916" : "#9C9590", boxShadow: lookback === n ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
                {n}M
              </button>
            ))}
          </div>
          <button onClick={reset} style={{ fontSize: 11, color: "#9C9590", background: "none", border: "1px solid #ECE7DE", borderRadius: 5, padding: "3px 10px", cursor: "pointer" }}>
            Reset to data
          </button>
        </div>
      </div>

      {/* Inputs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#6B6760", display: "block", marginBottom: 4 }}>Leads / mo</label>
          <input style={inputStyle} type="number" min={0} step={0.5} value={leads}
            onChange={e => setLeads(parseFloat(e.target.value) || 0)} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#6B6760", display: "block", marginBottom: 4 }}>Close Rate %</label>
          <input style={inputStyle} type="number" min={0} max={100} step={0.1} value={closeRate}
            onChange={e => setCloseRate(parseFloat(e.target.value) || 0)} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#6B6760", display: "block", marginBottom: 4 }}>Avg Deal Size</label>
          <div style={{ display: "flex", alignItems: "center", border: "1px solid #ECE7DE", borderRadius: 6, background: "#fff", width: "100%", boxSizing: "border-box" }}>
            <span style={{ padding: "0 2px 0 10px", fontSize: 13, color: "#9C9590", flexShrink: 0, userSelect: "none" }}>{sym}</span>
            <input style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: "inherit", fontSize: 13, color: "#1A1916", padding: "6px 10px 6px 4px", width: "100%", boxSizing: "border-box" }}
              type="number" min={0} step={100} value={avgDeal}
              onChange={e => setAvgDeal(parseFloat(e.target.value) || 0)} />
          </div>
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#6B6760", display: "block", marginBottom: 4 }}>Churn / mo</label>
          <input style={inputStyle} type="number" min={0} step={0.5} value={churn}
            onChange={e => setChurn(parseFloat(e.target.value) || 0)} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#6B6760", display: "block", marginBottom: 4 }}>Hrs / client</label>
          <input style={inputStyle} type="number" min={0} step={0.5} value={hoursPerClient}
            onChange={e => setHoursPerClient(parseFloat(e.target.value) || 0)} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#6B6760", display: "block", marginBottom: 4 }}>Billable Hrs</label>
          <input style={inputStyle} type="number" min={0} step={10} value={billableHours || ""}
            onChange={e => setBillableHours(parseFloat(e.target.value) || 0)}
            placeholder="0" />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#6B6760", display: "block", marginBottom: 4 }}>MRR Goal {sym}</label>
          <input style={inputStyle} type="number" min={0} step={1000} value={revenueGoal || ""}
            onChange={e => setRevenueGoal(parseFloat(e.target.value) || 0)}
            placeholder="50000" />
        </div>
      </div>

      {/* Summary row */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 14, fontSize: 11, color: "#9C9590" }}>
        <span>
          <span style={{ color: "#1A1916", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
            +{fmt$(newClientsPerMonth * avgDeal)}
          </span>
          {" new MRR/mo "}
          <span style={{ color: "#1A1916", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
            −{fmt$(churn * avgDeal)}
          </span>
          {" churn/mo → "}
          <span style={{ color: netMRRChange >= 0 ? "#1F7A4D" : "#C2410C", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
            {netMRRChange >= 0 ? "+" : ""}{fmt$(netMRRChange)}/mo net
          </span>
        </span>
        {revenueGoal > 0 && goalHitMonth >= 0 && (
          <span>
            {"· "}
            <span style={{ color: "#1F7A4D", fontWeight: 600 }}>
              Goal reached month {goalHitMonth + 1} ({monthLabels[goalHitMonth]})
            </span>
          </span>
        )}
        {revenueGoal > 0 && goalHitMonth === -1 && (
          <span style={{ color: "#C2410C" }}>· Goal not reached in 12 months at this rate</span>
        )}
      </div>

      {/* Capacity row — only shown when billable hours configured */}
      {billableHours > 0 && hoursPerClient > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 14, fontSize: 11, padding: "8px 12px", background: "#F5F1EC", borderRadius: 8 }}>
          <span style={{ color: "#6B6760" }}>
            <span style={{ fontWeight: 700, color: "#1A1916" }}>{Math.round(currentHoursUsed)}</span>
            {" of "}
            <span style={{ fontWeight: 700, color: "#1A1916" }}>{billableHours}</span>
            {" hrs used now"}
          </span>
          {slotsAvailable !== null && (
            <span style={{ color: "#6B6760" }}>
              {"· "}
              <span style={{ fontWeight: 700, color: hoursAvailable > 0 ? "#1F7A4D" : "#C2410C" }}>
                {slotsAvailable > 0 ? `${slotsAvailable} slot${slotsAvailable === 1 ? "" : "s"} open` : "At capacity"}
              </span>
              {" at current hrs/client"}
            </span>
          )}
          {mrrCap !== undefined && (
            <span style={{ color: "#6B6760" }}>
              {"· MRR ceiling "}
              <span style={{ fontWeight: 700, color: "#1A1916" }}>{fmt$(mrrCap)}</span>
              {maxClients !== null ? ` (${maxClients} clients)` : ""}
            </span>
          )}
        </div>
      )}

      {/* Chart */}
      <div style={{ position: "relative", width: "100%", paddingTop: `${(H / W) * 100}%` }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}>
          {/* Grid + Y-axis labels */}
          {yTicks.map((tick, i) => (
            <g key={i}>
              <line x1={PL} y1={toY(tick)} x2={W - PR} y2={toY(tick)} stroke="#ECE7DE" strokeWidth={1} />
              <text x={PL - 8} y={toY(tick) + 4} textAnchor="end" fontSize={10} fill="#9C9590">
                {fmtAxis(tick, sym)}
              </text>
            </g>
          ))}

          {/* X-axis labels */}
          {monthLabels.map((label, i) => {
            if (i % 3 !== 0 && i !== 11) return null
            return (
              <text key={i} x={toX(i)} y={H - 6} textAnchor="middle" fontSize={10} fill="#9C9590">
                {label}
              </text>
            )
          })}

          {/* Capacity ceiling line */}
          {capY !== null && mrrCap !== undefined && (
            <>
              <line x1={PL} y1={capY} x2={W - PR} y2={capY}
                stroke="#6B6760" strokeWidth={1} strokeDasharray="3,3" opacity={0.4} />
              <text x={W - PR - 4} y={capY - 4} fontSize={10} fill="#6B6760" textAnchor="end" opacity={0.7}>
                Capacity ceiling {fmt$(mrrCap)}
              </text>
            </>
          )}

          {/* Goal line */}
          {goalY !== null && (
            <>
              <line x1={PL} y1={goalY} x2={W - PR} y2={goalY}
                stroke="#E9532A" strokeWidth={1} strokeDasharray="4,3" opacity={0.5} />
              <text x={W - PR - 4} y={goalY - 4} fontSize={10} fill="#E9532A" textAnchor="end" opacity={0.8}>
                Goal {fmt$(revenueGoal)}
              </text>
            </>
          )}

          {/* Capacity hit marker */}
          {capacityHitMonth >= 0 && (
            <line x1={toX(capacityHitMonth)} y1={PT} x2={toX(capacityHitMonth)} y2={PT + plotH}
              stroke="#6B6760" strokeWidth={1} strokeDasharray="3,2" opacity={0.3} />
          )}

          {/* Projected path */}
          <path d={pathD} fill="none" stroke="#E9532A" strokeWidth={2} strokeDasharray="5,3" />

          {/* Dots */}
          {projected.map((v, i) => (
            <circle key={i} cx={toX(i)} cy={toY(v)} r={3.5}
              fill={mrrCap !== undefined && v >= mrrCap ? "#6B6760" : "#E9532A"}
              stroke={mrrCap !== undefined && v >= mrrCap ? "#6B6760" : "#E9532A"}
              strokeWidth={2} opacity={0.7} />
          ))}
        </svg>
      </div>
    </div>
  )
}
