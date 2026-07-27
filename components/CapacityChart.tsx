"use client"
import { fmtCurrency } from "@/lib/calc"

function currSym(c: string) { return c === "GBP" ? "£" : c === "EUR" ? "€" : "$" }

function fmtAxis(v: number, sym: string): string {
  if (Math.abs(v) >= 100000) return sym + Math.round(v / 1000) + "k"
  if (Math.abs(v) >= 10000) return sym + (Math.round(v / 100) / 10) + "k"
  return sym + Math.round(v).toLocaleString()
}

interface Props {
  projected: number[]        // 12 months
  startValue: number
  mrrCap: number | null
  goal: number
  capacityHitMonth: number
  monthLabels: string[]
  currency: string
}

const accent = "#E9532A"

export default function CapacityChart({ projected, startValue, mrrCap, goal, capacityHitMonth, monthLabels, currency }: Props) {
  const sym = currSym(currency)
  const fmt$ = (v: number) => fmtCurrency(v, currency)

  const allVals = [startValue, ...projected, goal, mrrCap ?? 0].filter(v => v > 0)
  const dataMax = allVals.length ? Math.max(...allVals) : 1
  const dataMin = allVals.length ? Math.min(...allVals) : 0
  const spread = dataMax - dataMin || dataMax * 0.15 || 1
  const maxVal = dataMax + spread * 0.2
  const yMin = Math.max(0, dataMin - spread * 0.2)
  const yRange = maxVal - yMin || 1
  const W = 880, H = 260, PL = 60, PR = 24, PT = 20, PB = 36
  const plotW = W - PL - PR
  const plotH = H - PT - PB
  const toX = (i: number) => PL + (i / 11) * plotW
  const toY = (v: number) => PT + plotH - ((v - yMin) / yRange) * plotH
  const yTicks = Array.from({ length: 5 }, (_, i) => yMin + (yRange * i) / 4)
  const pathD = projected.map((v, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(v)}`).join(" ")
  const goalY = goal > 0 ? toY(goal) : null
  const capY = mrrCap != null ? toY(mrrCap) : null

  return (
    <div style={{ position: "relative", width: "100%", paddingTop: `${(H / W) * 100}%` }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}>
        {yTicks.map((tick, i) => (
          <g key={i}>
            <line x1={PL} y1={toY(tick)} x2={W - PR} y2={toY(tick)} stroke="#ECE7DE" strokeWidth={1} />
            <text x={PL - 8} y={toY(tick) + 4} textAnchor="end" fontSize={10} fill="#9C9590">{fmtAxis(tick, sym)}</text>
          </g>
        ))}
        {monthLabels.map((label, i) => {
          if (i % 3 !== 0 && i !== 11) return null
          return <text key={i} x={toX(i)} y={H - 6} textAnchor="middle" fontSize={10} fill="#9C9590">{label}</text>
        })}
        {capY !== null && mrrCap != null && (
          <>
            <line x1={PL} y1={capY} x2={W - PR} y2={capY} stroke="#6B6760" strokeWidth={1} strokeDasharray="3,3" opacity={0.4} />
            <text x={W - PR - 4} y={capY - 4} fontSize={10} fill="#6B6760" textAnchor="end" opacity={0.7}>Capacity ceiling {fmt$(mrrCap)}</text>
          </>
        )}
        {goalY !== null && (
          <>
            <line x1={PL} y1={goalY} x2={W - PR} y2={goalY} stroke={accent} strokeWidth={1} strokeDasharray="4,3" opacity={0.5} />
            <text x={W - PR - 4} y={goalY - 4} fontSize={10} fill={accent} textAnchor="end" opacity={0.8}>Goal {fmt$(goal)}</text>
          </>
        )}
        {capacityHitMonth >= 0 && (
          <line x1={toX(capacityHitMonth)} y1={PT} x2={toX(capacityHitMonth)} y2={PT + plotH} stroke="#6B6760" strokeWidth={1} strokeDasharray="3,2" opacity={0.3} />
        )}
        <path d={pathD} fill="none" stroke={accent} strokeWidth={2} strokeDasharray="5,3" />
        {projected.map((v, i) => (
          <circle key={i} cx={toX(i)} cy={toY(v)} r={3.5}
            fill={mrrCap != null && v >= mrrCap ? "#6B6760" : accent}
            stroke={mrrCap != null && v >= mrrCap ? "#6B6760" : accent}
            strokeWidth={2} opacity={0.7} />
        ))}
      </svg>
    </div>
  )
}
