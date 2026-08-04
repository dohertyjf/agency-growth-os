"use client"
import { useState } from "react"
import { useCurrency } from "@/lib/CurrencyContext"

function currSym(c: string) {
  if (c === "GBP") return "£"
  if (c === "EUR") return "€"
  return "$"
}

export interface ChartPoint {
  label: string
  value: number
  projected?: boolean
}

export interface FlowBars {
  newRevenue: number[]
  churnedRevenue: number[]
}

interface Props {
  points: ChartPoint[]
  format: "currency" | "percent" | "number"
  label: string
  series2?: ChartPoint[]
  series2Label?: string
  series3?: ChartPoint[]
  series3Label?: string
  series4?: ChartPoint[]
  series4Label?: string
  flowBars?: FlowBars
  goalValue?: number
}

const OPP_COLOR = "#8B5CF6"

function fmt(v: number, format: "currency" | "percent" | "number", sym = "$"): string {
  if (format === "currency") {
    if (Math.abs(v) >= 100000) return sym + Math.round(v / 1000) + "k"
    if (Math.abs(v) >= 10000) return sym + (Math.round(v / 100) / 10) + "k"
    return sym + Math.round(v).toLocaleString()
  }
  if (format === "percent") return (Math.round(v * 10) / 10) + "%"
  return String(Math.round(v))
}

const PAD = { top: 20, right: 24, bottom: 36, left: 60 }
const VW = 880
const VH = 240

export default function MetricChart({ points, format, label, series2, series2Label, series3, series3Label, series4, series4Label, flowBars, goalValue }: Props) {
  const [hover, setHover] = useState<number | null>(null)
  const sym = currSym(useCurrency())

  if (!points.length && !series2?.length) {
    return (
      <div>
        <div style={{ fontSize: 11, color: "#9C9590", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 4 }}>
          {label}
        </div>
        <div style={{ height: 150, display: "flex", alignItems: "center", justifyContent: "center", color: "#9C9590", fontSize: 14 }}>
          No data to display
        </div>
      </div>
    )
  }

  const plotW = VW - PAD.left - PAD.right
  const plotH = VH - PAD.top - PAD.bottom

  const barVals = flowBars ? [...flowBars.newRevenue, ...flowBars.churnedRevenue] : []
  const allVals = [...points, ...(series2 ?? []), ...(series3 ?? []), ...(series4 ?? [])].map(p => p.value).concat(barVals)
  const dataMin = Math.min(...allVals)
  const dataMax = Math.max(...allVals)

  let yMin: number, yMax: number
  if (format === "percent") {
    // Percentages read on a fixed 0–100% frame (extended only if data falls outside it).
    yMin = Math.min(0, dataMin)
    yMax = Math.max(100, dataMax)
  } else {
    // Currency + counts: grounded at 0 so growth reads honestly (no zoom); the top
    // scales to this client's own data (and goal), with a little headroom.
    yMin = Math.min(0, dataMin)
    const top = Math.max(dataMax, goalValue ? goalValue * 1.15 : 0)
    yMax = Math.max(top * 1.12, 1)
  }
  const yRange = yMax - yMin
  const crossesZero = yMin < 0 && yMax > 0

  const refPoints = points.length ? points : (series2 ?? [])

  const toX = (i: number) =>
    refPoints.length === 1
      ? PAD.left + plotW / 2
      : PAD.left + (i / (refPoints.length - 1)) * plotW

  const toY = (v: number) => PAD.top + plotH - ((v - yMin) / yRange) * plotH

  const tickCount = 4
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => yMin + (yRange * i) / tickCount)

  function buildPaths(pts: ChartPoint[]) {
    const hist: { i: number; p: ChartPoint }[] = []
    const proj: { i: number; p: ChartPoint }[] = []
    pts.forEach((p, i) => { (p.projected ? proj : hist).push({ i, p }) })
    const histPath = hist.map(({ i, p }, j) => `${j === 0 ? "M" : "L"} ${toX(i)},${toY(p.value)}`).join(" ")
    let projPath = ""
    if (proj.length && hist.length) {
      const last = hist[hist.length - 1]
      projPath = `M ${toX(last.i)},${toY(last.p.value)} ` + proj.map(({ i, p }) => `L ${toX(i)},${toY(p.value)}`).join(" ")
    } else if (proj.length) {
      projPath = proj.map(({ i, p }, j) => `${j === 0 ? "M" : "L"} ${toX(i)},${toY(p.value)}`).join(" ")
    }
    return { histPath, projPath, hasProj: proj.length > 0 }
  }

  const s1 = buildPaths(points)
  const s2 = series2?.length ? buildPaths(series2) : null
  const s3 = series3?.length ? buildPaths(series3) : null
  const s4 = series4?.length ? buildPaths(series4) : null

  const colW = refPoints.length > 1 ? plotW / refPoints.length : plotW
  const hasBothSeries = !!(points.length && series2?.length)
  const hasSeries3 = !!(series3?.length)
  const hasSeries4 = !!(series4?.length)
  const hasProjected = s1.hasProj || (s2?.hasProj ?? false) || (s3?.hasProj ?? false) || (s4?.hasProj ?? false)

  return (
    <div style={{ position: "relative" }}>
      <div style={{ fontSize: 11, color: "#9C9590", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 4 }}>
        {label}
      </div>
      {/* padding-top trick: container height tracks width at the SVG native aspect ratio — makes chart truly fill 100% width */}
      <div style={{ position: "relative", width: "100%", paddingTop: `${(VH / VW) * 100}%` }}>
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
          onMouseLeave={() => setHover(null)}
        >
          {/* Grid + Y labels */}
          {yTicks.map((tick, i) => (
            <g key={i}>
              <line x1={PAD.left} y1={toY(tick)} x2={VW - PAD.right} y2={toY(tick)} stroke="#ECE7DE" strokeWidth={1} />
              <text x={PAD.left - 8} y={toY(tick) + 4} textAnchor="end" fontSize={10} fill="#9C9590">
                {fmt(tick, format, sym)}
              </text>
            </g>
          ))}

          {/* X labels */}
          {refPoints.map((p, i) => {
            const step = refPoints.length > 18 ? 4 : refPoints.length > 10 ? 2 : 1
            if (i % step !== 0 && i !== refPoints.length - 1) return null
            return (
              <text key={i} x={toX(i)} y={VH - 6} textAnchor="middle" fontSize={10} fill={p.projected ? "#C0BAB2" : "#6B6760"}>
                {p.label}
              </text>
            )
          })}

          {/* Zero reference line — only shown when chart crosses zero */}
          {crossesZero && (
            <g>
              <line x1={PAD.left} y1={toY(0)} x2={VW - PAD.right} y2={toY(0)} stroke="#9C9590" strokeWidth={1} strokeDasharray="3,2" opacity={0.5} />
              <text x={PAD.left - 8} y={toY(0) + 4} textAnchor="end" fontSize={10} fill="#9C9590" opacity={0.7}>{sym}0</text>
            </g>
          )}

          {/* Goal line */}
          {goalValue != null && goalValue > 0 && (() => {
            const gy = toY(goalValue)
            return (
              <g>
                <line x1={PAD.left} y1={gy} x2={VW - PAD.right} y2={gy} stroke="#16A34A" strokeWidth={1.5} strokeDasharray="6,4" opacity={0.7} />
                <text x={VW - PAD.right - 4} y={gy - 5} fontSize={10} fill="#16A34A" textAnchor="end" fontWeight="600" opacity={0.85}>
                  Goal {fmt(goalValue, format, sym)}
                </text>
              </g>
            )
          })()}

          {/* Flow bars — new (green) and churned (red), drawn behind everything */}
          {flowBars && (() => {
            const barW = Math.max(4, colW * 0.22)
            const baseY = toY(0)
            return (
              <>
                {flowBars.newRevenue.map((v, i) => {
                  if (!v) return null
                  const x = toX(i) - barW - 1
                  const y = toY(v)
                  return <rect key={i} x={x} y={y} width={barW} height={baseY - y} fill="#22C55E" opacity={0.75} rx={1} />
                })}
                {flowBars.churnedRevenue.map((v, i) => {
                  if (!v) return null
                  const x = toX(i) + 1
                  const y = toY(v)
                  return <rect key={i} x={x} y={y} width={barW} height={baseY - y} fill="#EF4444" opacity={0.75} rx={1} />
                })}
              </>
            )
          })()}

          {/* Series 4 (with opportunity) — drawn furthest back, least certain */}
          {s4 && (
            <>
              {s4.histPath && <path d={s4.histPath} fill="none" stroke={OPP_COLOR} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" opacity={0.4} />}
              {s4.projPath && <path d={s4.projPath} fill="none" stroke={OPP_COLOR} strokeWidth={1.5} strokeDasharray="6,4" strokeLinejoin="round" strokeLinecap="round" opacity={0.28} />}
              {series4!.map((p, i) => (
                <circle key={i} cx={toX(i)} cy={toY(p.value)} r={2.5} fill={p.projected ? "#fff" : OPP_COLOR} stroke={OPP_COLOR} strokeWidth={1.5} opacity={0.4} />
              ))}
            </>
          )}

          {/* Series 2 (with potential) — drawn behind series 1 */}
          {s2 && (
            <>
              {s2.histPath && <path d={s2.histPath} fill="none" stroke="#2563EB" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" opacity={0.5} />}
              {s2.projPath && <path d={s2.projPath} fill="none" stroke="#2563EB" strokeWidth={1.5} strokeDasharray="6,4" strokeLinejoin="round" strokeLinecap="round" opacity={0.3} />}
              {series2!.map((p, i) => (
                <circle key={i} cx={toX(i)} cy={toY(p.value)} r={2.5} fill={p.projected ? "#fff" : "#2563EB"} stroke="#2563EB" strokeWidth={1.5} opacity={0.5} />
              ))}
            </>
          )}

          {/* Series 3 (cash collected) — drawn behind series 1 */}
          {s3 && (
            <>
              {s3.histPath && <path d={s3.histPath} fill="none" stroke="#0D9488" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" opacity={0.85} />}
              {s3.projPath && <path d={s3.projPath} fill="none" stroke="#0D9488" strokeWidth={1.5} strokeDasharray="6,4" strokeLinejoin="round" strokeLinecap="round" opacity={0.4} />}
              {series3!.map((p, i) => (
                <circle key={i} cx={toX(i)} cy={toY(p.value)} r={2.5} fill={p.projected ? "#fff" : "#0D9488"} stroke="#0D9488" strokeWidth={1.5} opacity={0.85} />
              ))}
            </>
          )}

          {/* Series 1 (contracted / primary) */}
          {s1.histPath && <path d={s1.histPath} fill="none" stroke="#E9532A" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />}
          {s1.projPath && <path d={s1.projPath} fill="none" stroke="#E9532A" strokeWidth={2} strokeDasharray="6,4" strokeLinejoin="round" strokeLinecap="round" opacity={0.6} />}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={toX(i)} cy={toY(p.value)}
              r={hover === i ? 5 : 3.5}
              fill={p.projected ? "#fff" : "#E9532A"}
              stroke="#E9532A" strokeWidth={2}
            />
          ))}

          {/* Hover hit areas */}
          {refPoints.map((_, i) => (
            <rect
              key={i}
              x={toX(i) - colW / 2} y={PAD.top}
              width={colW} height={plotH}
              fill="transparent"
              style={{ cursor: "crosshair" }}
              onMouseEnter={() => setHover(i)}
            />
          ))}

          {/* Tooltip */}
          {hover !== null && (() => {
            const p1 = points[hover]
            const p2 = series2?.[hover]
            const p3 = series3?.[hover]
            const p4 = series4?.[hover]
            const newRev = flowBars?.newRevenue[hover] ?? 0
            const churnRev = flowBars?.churnedRevenue[hover] ?? 0
            const anchor = p1 ?? p2
            if (!anchor) return null
            const tx = toX(hover)
            const ty = toY(anchor.value)
            const flip = tx > VW * 0.65

            const rows: { label: string; value: number; color: string }[] = []
            if (p1) rows.push({ label: hasBothSeries ? "Contracted" : p3 ? "MRR" : "", value: p1.value, color: "#FF8B6A" })
            if (p2) rows.push({ label: "Qualified", value: p2.value, color: "#93C5FD" })
            if (p4) rows.push({ label: "Opportunity", value: p4.value, color: "#C4B5FD" })
            if (p3) rows.push({ label: "Cash", value: p3.value, color: "#2DD4BF" })
            if (newRev) rows.push({ label: "New", value: newRev, color: "#4ADE80" })
            if (churnRev) rows.push({ label: "Churn", value: churnRev, color: "#F87171" })

            const hasLabels = rows.some(r => r.label)
            const ttW = hasLabels ? 148 : 90
            const ttH = Math.max(22, rows.length * 17 + 8)
            const ttX = flip ? tx - ttW - 6 : tx + 8
            const ttY = ty - ttH / 2

            return (
              <g>
                <line x1={tx} y1={PAD.top} x2={tx} y2={PAD.top + plotH} stroke="#D0C9BF" strokeWidth={1} strokeDasharray="3,2" />
                <rect x={ttX} y={ttY} width={ttW} height={ttH} rx={4} fill="#1A1916" />
                {rows.map((r, i) => (
                  <g key={i}>
                    {r.label && (
                      <text x={ttX + 8} y={ttY + 13 + i * 17} fontSize={11} fill={r.color} fontWeight="600" opacity={0.7}>
                        {r.label}
                      </text>
                    )}
                    <text x={ttX + ttW - 8} y={ttY + 13 + i * 17} fontSize={11} fill={r.color} fontWeight="600" textAnchor="end">
                      {fmt(r.value, format, sym)}
                    </text>
                  </g>
                ))}
              </g>
            )
          })()}
        </svg>
      </div>

      {/* Legend */}
      {(hasBothSeries || hasProjected || flowBars || hasSeries3 || hasSeries4 || (goalValue != null && goalValue > 0)) && (
        <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#9C9590", marginTop: 6, flexWrap: "wrap" }}>
          {hasBothSeries ? (
            <>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <svg width={20} height={4}><line x1={0} y1={2} x2={20} y2={2} stroke="#E9532A" strokeWidth={2} /></svg>
                Contracted
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <svg width={20} height={4}><line x1={0} y1={2} x2={20} y2={2} stroke="#2563EB" strokeWidth={2} opacity={0.5} /></svg>
                {series2Label ?? "With Qualified"}
              </span>
            </>
          ) : hasProjected ? (
            <>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <svg width={20} height={4}><line x1={0} y1={2} x2={20} y2={2} stroke="#E9532A" strokeWidth={2} /></svg>
                Actual
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <svg width={20} height={4}><line x1={0} y1={2} x2={20} y2={2} stroke="#E9532A" strokeWidth={2} strokeDasharray="4,3" opacity={0.6} /></svg>
                Projected
              </span>
            </>
          ) : null}
          {hasSeries4 && (
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <svg width={20} height={4}><line x1={0} y1={2} x2={20} y2={2} stroke={OPP_COLOR} strokeWidth={2} opacity={0.5} /></svg>
              {series4Label ?? "With Opportunity"}
            </span>
          )}
          {hasSeries3 && (
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <svg width={20} height={4}><line x1={0} y1={2} x2={20} y2={2} stroke="#0D9488" strokeWidth={2} /></svg>
              {series3Label ?? "Cash Collected"}
            </span>
          )}
          {goalValue != null && goalValue > 0 && (
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <svg width={20} height={4}><line x1={0} y1={2} x2={20} y2={2} stroke="#16A34A" strokeWidth={1.5} strokeDasharray="6,4" opacity={0.7} /></svg>
              Revenue Goal
            </span>
          )}
          {flowBars && (
            <>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <svg width={12} height={10}><rect x={0} y={0} width={12} height={10} fill="#22C55E" opacity={0.75} rx={1} /></svg>
                New revenue
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <svg width={12} height={10}><rect x={0} y={0} width={12} height={10} fill="#EF4444" opacity={0.75} rx={1} /></svg>
                Churned revenue
              </span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
