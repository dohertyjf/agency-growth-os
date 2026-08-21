"use client"
import { useState } from "react"
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
  ceilingHitMonth: number
  monthLabels: string[]
  currency: string
  /** What the ceiling line represents — depends on which constraint binds. */
  ceilingLabel?: string
}

const accent = "#E9532A"

export default function CapacityChart({ projected, startValue, mrrCap, goal, ceilingHitMonth, monthLabels, currency, ceilingLabel = "Capacity ceiling" }: Props) {
  const sym = currSym(currency)
  const fmt$ = (v: number) => fmtCurrency(v, currency)
  const [hover, setHover] = useState<number | null>(null)

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
            <text x={W - PR - 4} y={capY - 4} fontSize={10} fill="#6B6760" textAnchor="end" opacity={0.7}>{ceilingLabel} {fmt$(mrrCap)}</text>
          </>
        )}
        {goalY !== null && (
          <>
            <line x1={PL} y1={goalY} x2={W - PR} y2={goalY} stroke={accent} strokeWidth={1} strokeDasharray="4,3" opacity={0.5} />
            <text x={W - PR - 4} y={goalY - 4} fontSize={10} fill={accent} textAnchor="end" opacity={0.8}>Goal {fmt$(goal)}</text>
          </>
        )}
        {ceilingHitMonth >= 0 && (
          <line x1={toX(ceilingHitMonth)} y1={PT} x2={toX(ceilingHitMonth)} y2={PT + plotH} stroke="#6B6760" strokeWidth={1} strokeDasharray="3,2" opacity={0.3} />
        )}
        <path d={pathD} fill="none" stroke={accent} strokeWidth={2} strokeDasharray="5,3" />
        {projected.map((v, i) => (
          <circle key={i} cx={toX(i)} cy={toY(v)} r={3.5}
            fill={mrrCap != null && v >= mrrCap ? "#6B6760" : accent}
            stroke={mrrCap != null && v >= mrrCap ? "#6B6760" : accent}
            strokeWidth={2} opacity={0.7} />
        ))}
        {hover !== null && (
          <>
            <line x1={toX(hover)} y1={PT} x2={toX(hover)} y2={PT + plotH} stroke="#1A1916" strokeWidth={1} opacity={0.18} />
            <circle cx={toX(hover)} cy={toY(projected[hover])} r={5}
              fill="#fff" stroke={mrrCap != null && projected[hover] >= mrrCap ? "#6B6760" : accent} strokeWidth={2.5} />
          </>
        )}
        {projected.map((_, i) => (
          <rect key={`h${i}`} x={toX(i) - plotW / 22} y={PT} width={plotW / 11} height={plotH}
            fill="transparent" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
        ))}
      </svg>
      {hover !== null && (() => {
        const v = projected[hover]
        const atCap = mrrCap != null && v >= mrrCap
        const toGoal = goal - v
        return (
          <div style={{ position: "absolute", left: `${(toX(hover) / W) * 100}%`, top: `${(toY(v) / H) * 100}%`, transform: "translate(-50%, -118%)", pointerEvents: "none", background: "#1A1916", color: "#fff", borderRadius: 8, padding: "7px 10px", fontSize: 12, whiteSpace: "nowrap", boxShadow: "0 4px 16px rgba(0,0,0,0.22)", zIndex: 5 }}>
            <div style={{ fontWeight: 700 }}>{monthLabels[hover]}</div>
            <div style={{ color: "#F0C9BB" }}>{fmt$(v)}/mo</div>
            <div style={{ fontSize: 11, color: "#C9C4BC", marginTop: 1 }}>
              {atCap ? "At capacity ceiling" : goal > 0 ? (toGoal > 0 ? `${fmt$(toGoal)} to goal` : "Goal reached") : ""}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
