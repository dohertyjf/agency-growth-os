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
  projected: number[]        // one entry per projected month
  startValue: number
  mrrCap: number | null
  goal: number
  ceilingHitMonth: number
  monthLabels: string[]
  /** Label for the starting point — the month they are in today. */
  startLabel?: string
  currency: string
  /** What the ceiling line represents — depends on which constraint binds. */
  ceilingLabel?: string
  /** The constraint waiting behind the binding one, drawn faintly. */
  secondCeiling?: { value: number; label: string } | null
  /** Untouched projection, drawn faintly behind an edited one for comparison. */
  baseline?: number[] | null
}

const accent = "#E9532A"

export default function CapacityChart({ projected, startValue, mrrCap, goal, ceilingHitMonth, monthLabels, startLabel = "now", currency, ceilingLabel = "Capacity ceiling", secondCeiling = null, baseline = null }: Props) {
  const sym = currSym(currency)
  const fmt$ = (v: number) => fmtCurrency(v, currency)
  const [hover, setHover] = useState<number | null>(null)

  // Today is the first point on the line. Without it the chart opens at month 1
  // — which, for an agency growing fast enough to hit its ceiling immediately,
  // renders as a flat line at the cap and hides the climb entirely.
  const series = [startValue, ...projected]
  const labels = [startLabel, ...monthLabels]

  const baseSeries = baseline ? [startValue, ...baseline] : null
  const allVals = [...series, ...(baseSeries ?? []), goal, mrrCap ?? 0, secondCeiling?.value ?? 0].filter(v => v > 0)
  const dataMax = allVals.length ? Math.max(...allVals) : 1
  const dataMin = allVals.length ? Math.min(...allVals) : 0
  const spread = dataMax - dataMin || dataMax * 0.15 || 1
  const maxVal = dataMax + spread * 0.2
  const yMin = Math.max(0, dataMin - spread * 0.2)
  const yRange = maxVal - yMin || 1
  const W = 880, H = 260, PL = 60, PR = 24, PT = 20, PB = 36
  const plotW = W - PL - PR
  const plotH = H - PT - PB
  // Generalised over however many months are projected (12, 24 or 36).
  const n = series.length
  const lastIdx = Math.max(1, n - 1)
  const toX = (i: number) => PL + (i / lastIdx) * plotW
  // Aim for ~5 x-axis labels regardless of horizon, always including the last.
  const labelStep = Math.max(1, Math.round(n / 5))
  const toY = (v: number) => PT + plotH - ((v - yMin) / yRange) * plotH
  const yTicks = Array.from({ length: 5 }, (_, i) => yMin + (yRange * i) / 4)
  const pathD = series.map((v, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(v)}`).join(" ")
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
        {labels.map((label, i) => {
          // Always label the last month; drop a step-label that would land on
          // top of it (at 36 months the step lands one month short).
          if (i !== lastIdx && (i % labelStep !== 0 || lastIdx - i < labelStep * 0.6)) return null
          return <text key={i} x={toX(i)} y={H - 6} textAnchor="middle" fontSize={10} fill="#9C9590">{label}</text>
        })}
        {capY !== null && mrrCap != null && (
          <>
            <line x1={PL} y1={capY} x2={W - PR} y2={capY} stroke="#6B6760" strokeWidth={1} strokeDasharray="3,3" opacity={0.4} />
            <text x={W - PR - 4} y={capY + (goalY !== null && Math.abs(capY - goalY) < 13 ? 12 : -4)} fontSize={10} fill="#6B6760" textAnchor="end" opacity={0.7}>{ceilingLabel} {fmt$(mrrCap)}</text>
          </>
        )}
        {secondCeiling && (
          <>
            <line x1={PL} y1={toY(secondCeiling.value)} x2={W - PR} y2={toY(secondCeiling.value)} stroke="#9C9590" strokeWidth={1} strokeDasharray="2,4" opacity={0.45} />
            <text x={PL + 4} y={toY(secondCeiling.value) - 4} fontSize={10} fill="#9C9590" textAnchor="start" opacity={0.75}>{secondCeiling.label} {fmt$(secondCeiling.value)}</text>
          </>
        )}
        {goalY !== null && (
          <>
            <line x1={PL} y1={goalY} x2={W - PR} y2={goalY} stroke={accent} strokeWidth={1} strokeDasharray="4,3" opacity={0.5} />
            <text x={W - PR - 4} y={goalY - 4} fontSize={10} fill={accent} textAnchor="end" opacity={0.8}>Goal {fmt$(goal)}</text>
          </>
        )}
        {ceilingHitMonth >= 0 && (
          <line x1={toX(ceilingHitMonth + 1)} y1={PT} x2={toX(ceilingHitMonth + 1)} y2={PT + plotH} stroke="#6B6760" strokeWidth={1} strokeDasharray="3,2" opacity={0.3} />
        )}
        {baseSeries && (
          <path d={baseSeries.map((v, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(v)}`).join(" ")}
            fill="none" stroke="#9C9590" strokeWidth={1.5} strokeDasharray="2,4" opacity={0.55} />
        )}
        <path d={pathD} fill="none" stroke={accent} strokeWidth={2} strokeDasharray="5,3" />
        {series.map((v, i) => (
          <circle key={i} cx={toX(i)} cy={toY(v)} r={3.5}
            fill={mrrCap != null && v >= mrrCap ? "#6B6760" : accent}
            stroke={mrrCap != null && v >= mrrCap ? "#6B6760" : accent}
            strokeWidth={2} opacity={0.7} />
        ))}
        {hover !== null && (
          <>
            <line x1={toX(hover)} y1={PT} x2={toX(hover)} y2={PT + plotH} stroke="#1A1916" strokeWidth={1} opacity={0.18} />
            <circle cx={toX(hover)} cy={toY(series[hover])} r={5}
              fill="#fff" stroke={mrrCap != null && series[hover] >= mrrCap ? "#6B6760" : accent} strokeWidth={2.5} />
          </>
        )}
        {series.map((_, i) => (
          <rect key={`h${i}`} x={toX(i) - plotW / (lastIdx * 2)} y={PT} width={plotW / lastIdx} height={plotH}
            fill="transparent" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
        ))}
      </svg>
      {hover !== null && (() => {
        const v = series[hover]
        const atCap = mrrCap != null && v >= mrrCap
        const toGoal = goal - v
        return (
          <div style={{ position: "absolute", left: `${(toX(hover) / W) * 100}%`, top: `${(toY(v) / H) * 100}%`, transform: "translate(-50%, -118%)", pointerEvents: "none", background: "#1A1916", color: "#fff", borderRadius: 8, padding: "7px 10px", fontSize: 12, whiteSpace: "nowrap", boxShadow: "0 4px 16px rgba(0,0,0,0.22)", zIndex: 5 }}>
            <div style={{ fontWeight: 700 }}>{labels[hover]}</div>
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
