"use client"
import { useState, useMemo } from "react"
import { fmtCurrency, ymAdd, ymLabel } from "@/lib/calc"

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
  avgDeal: number, churnCount: number, months: number
): number[] {
  const result: number[] = []
  let mrr = startMRR
  for (let i = 0; i < months; i++) {
    const newMRR = leads * (closeRate / 100) * avgDeal
    const churnedMRR = churnCount * avgDeal
    mrr = Math.max(0, mrr + newMRR - churnedMRR)
    result.push(Math.round(mrr))
  }
  return result
}

function projectClients(
  startClients: number, leads: number, closeRate: number,
  churnCount: number, months: number
): number[] {
  const result: number[] = []
  let clients = startClients
  for (let i = 0; i < months; i++) {
    clients = Math.max(0, clients + leads * (closeRate / 100) - churnCount)
    result.push(Math.round(clients * 10) / 10)
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

  function reset() {
    setLeads(defaultLeads)
    setCloseRate(defaultCloseRate)
    setAvgDeal(Math.round(avgContractSize))
    setChurn(defaultChurn)
    setHoursPerClient(round1(avgContractHours))
  }

  const projected = useMemo(
    () => projectMRR(startMRR, leads, closeRate, avgDeal, churn, 12),
    [startMRR, leads, closeRate, avgDeal, churn]
  )

  const projectedClients = useMemo(
    () => projectClients(activeClientCount, leads, closeRate, churn, 12),
    [activeClientCount, leads, closeRate, churn]
  )

  const projectedHours = useMemo(
    () => projectedClients.map(c => Math.round(c * hoursPerClient * 10) / 10),
    [projectedClients, hoursPerClient]
  )

  const monthLabels = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ymLabel(ymAdd(now, i + 1))),
    [now]
  )

  const capacityHitMonth = totalCapacityHours > 0 && hoursPerClient > 0
    ? projectedHours.findIndex(h => h > totalCapacityHours)
    : -1

  // Chart
  const allVals = [startMRR, ...projected, goalMRR ?? 0].filter(v => v > 0)
  const maxVal = allVals.length ? Math.max(...allVals) * 1.1 : 1
  const W = 520, H = 140, PL = 0, PR = 0, PT = 12, PB = 20
  const plotW = W - PL - PR
  const plotH = H - PT - PB
  const toX = (i: number) => PL + (i / 11) * plotW
  const toY = (v: number) => PT + plotH - (v / maxVal) * plotH

  const pathD = projected.map((v, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(v)}`).join(" ")
  const goalY = goalMRR ? toY(goalMRR) : null

  const goalHitMonth = goalMRR ? projected.findIndex(v => v >= goalMRR) : -1

  const newClientsPerMonth = leads * (closeRate / 100)
  const netMRRChange = newClientsPerMonth * avgDeal - churn * avgDeal

  const currentHoursUsed = activeClientCount * hoursPerClient
  const hoursAvailable = totalCapacityHours - currentHoursUsed
  const slotsAvailable = hoursPerClient > 0 ? Math.floor(hoursAvailable / hoursPerClient) : null

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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
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
          <label style={{ fontSize: 11, fontWeight: 600, color: "#6B6760", display: "block", marginBottom: 4 }}>Avg Deal Size $</label>
          <input style={inputStyle} type="number" min={0} step={100} value={avgDeal}
            onChange={e => setAvgDeal(parseFloat(e.target.value) || 0)} />
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
      </div>

      {/* Summary row */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 14, fontSize: 11, color: "#9C9590" }}>
        <span>
          <span style={{ color: "#1A1916", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
            +{fmtCurrency(newClientsPerMonth * avgDeal)}
          </span>
          {" new MRR/mo "}
          <span style={{ color: "#1A1916", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
            −{fmtCurrency(churn * avgDeal)}
          </span>
          {" churn/mo → "}
          <span style={{ color: netMRRChange >= 0 ? "#1F7A4D" : "#C2410C", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
            {netMRRChange >= 0 ? "+" : ""}{fmtCurrency(netMRRChange)}/mo net
          </span>
        </span>
        {goalMRR && goalHitMonth >= 0 && (
          <span>
            {"· "}
            <span style={{ color: "#1F7A4D", fontWeight: 600 }}>
              Goal reached month {goalHitMonth + 1} ({monthLabels[goalHitMonth]})
            </span>
          </span>
        )}
        {goalMRR && goalHitMonth === -1 && (
          <span style={{ color: "#C2410C" }}>· Goal not reached in 12 months at this rate</span>
        )}
      </div>

      {/* Capacity row — only shown when capacity is configured */}
      {totalCapacityHours > 0 && hoursPerClient > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 14, fontSize: 11, padding: "8px 12px", background: "#F5F1EC", borderRadius: 8 }}>
          <span style={{ color: "#6B6760" }}>
            <span style={{ fontWeight: 700, color: "#1A1916" }}>{Math.round(currentHoursUsed)}</span>
            {" of "}
            <span style={{ fontWeight: 700, color: "#1A1916" }}>{totalCapacityHours}</span>
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
          {capacityHitMonth >= 0 && (
            <span style={{ color: "#C2410C", fontWeight: 600 }}>
              · Capacity full month {capacityHitMonth + 1} ({monthLabels[capacityHitMonth]}) — need to hire or raise prices before then
            </span>
          )}
          {capacityHitMonth === -1 && projectedClients[11] > 0 && (
            <span style={{ color: "#6B6760" }}>· Capacity not hit in 12 months</span>
          )}
        </div>
      )}

      {/* Chart */}
      <div style={{ overflowX: "auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
          {/* Goal line */}
          {goalY !== null && (
            <>
              <line x1={PL} y1={goalY} x2={W - PR} y2={goalY}
                stroke="#E9532A" strokeWidth={1} strokeDasharray="4,3" opacity={0.5} />
              <text x={W - PR - 4} y={goalY - 3} fontSize={9} fill="#E9532A" textAnchor="end" opacity={0.7}>
                Goal {fmtCurrency(goalMRR!)}
              </text>
            </>
          )}

          {/* Start MRR dot + label */}
          <circle cx={PL - 8} cy={toY(startMRR)} r={0} />

          {/* Projected path */}
          <path d={pathD} fill="none" stroke="#E9532A" strokeWidth={2} strokeDasharray="5,3" />

          {/* Capacity hit marker */}
          {capacityHitMonth >= 0 && (
            <line
              x1={toX(capacityHitMonth)} y1={PT}
              x2={toX(capacityHitMonth)} y2={PT + plotH}
              stroke="#C2410C" strokeWidth={1} strokeDasharray="3,2" opacity={0.5}
            />
          )}

          {/* Dots + month labels */}
          {projected.map((v, i) => (
            <g key={i}>
              <circle cx={toX(i)} cy={toY(v)} r={3}
                fill={capacityHitMonth >= 0 && i >= capacityHitMonth ? "#C2410C" : "#E9532A"}
                opacity={0.6} />
              {(i === 0 || i === 2 || i === 5 || i === 8 || i === 11) && (
                <>
                  <text x={toX(i)} y={H - 4} fontSize={9} fill="#9C9590" textAnchor="middle">
                    {monthLabels[i]}
                  </text>
                  <text x={toX(i)} y={toY(v) - 6} fontSize={9} fill="#1A1916" textAnchor="middle" fontWeight="600">
                    {fmtCurrency(v)}
                  </text>
                </>
              )}
            </g>
          ))}
        </svg>
      </div>
    </div>
  )
}
