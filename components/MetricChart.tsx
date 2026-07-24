"use client"
import { useState } from "react"

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
  flowBars?: FlowBars
}

function fmt(v: number, format: "currency" | "percent" | "number"): string {
  if (format === "currency") {
    if (Math.abs(v) >= 100000) return "$" + Math.round(v / 1000) + "k"
    if (Math.abs(v) >= 10000) return "$" + (Math.round(v / 100) / 10) + "k"
    return "$" + Math.round(v).toLocaleString()
  }
  if (format === "percent") return (Math.round(v * 10) / 10) + "%"
  return String(Math.round(v))
}

const PAD = { top: 20, right: 24, bottom: 36, left: 60 }
const VW = 880
const VH = 240

export default function MetricChart({ points, format, label, series2, series2Label, flowBars }: Props) {
  const [hover, setHover] = useState<number | null>(null)

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
  const allVals = [...points, ...(series2 ?? [])].map(p => p.value).concat(barVals)
  const dataMin = Math.min(...allVals)
  const dataMax = Math.max(...allVals)
  const spread = dataMax - dataMin || Math.abs(dataMax) || 1
  const rawYMin = dataMin - spread * 0.12
  const yMin = format === "currency" ? Math.max(0, rawYMin) : rawYMin
  const yMax = dataMax + spread * 0.12
  const yRange = yMax - yMin

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

  const colW = refPoints.length > 1 ? plotW / refPoints.length : plotW
  const hasBothSeries = !!(points.length && series2?.length)
  const hasProjected = s1.hasProj || (s2?.hasProj ?? false)

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
                {fmt(tick, format)}
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
            const anchor = p1 ?? p2
            if (!anchor) return null
            const tx = toX(hover)
            const ty = toY(anchor.value)
            const flip = tx > VW * 0.65
            const ttW = 90
            const ttH = (p1 && p2) ? 38 : 22
            const ttX = flip ? tx - ttW - 6 : tx + 8
            return (
              <g>
                <line x1={tx} y1={PAD.top} x2={tx} y2={PAD.top + plotH} stroke="#D0C9BF" strokeWidth={1} strokeDasharray="3,2" />
                <rect x={ttX} y={ty - 14} width={ttW} height={ttH} rx={4} fill="#1A1916" />
                {p1 && <text x={ttX + ttW / 2} y={ty + (p2 ? -1 : 3)} textAnchor="middle" fontSize={11} fill="#FF8B6A" fontWeight="600">{fmt(p1.value, format)}</text>}
                {p2 && <text x={ttX + ttW / 2} y={ty + (p1 ? 16 : 3)} textAnchor="middle" fontSize={11} fill="#93C5FD" fontWeight="600">{fmt(p2.value, format)}</text>}
              </g>
            )
          })()}
        </svg>
      </div>

      {/* Legend */}
      {(hasBothSeries || hasProjected || flowBars) && (
        <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#9C9590", marginTop: 6 }}>
          {hasBothSeries ? (
            <>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <svg width={20} height={4}><line x1={0} y1={2} x2={20} y2={2} stroke="#E9532A" strokeWidth={2} /></svg>
                Contracted
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <svg width={20} height={4}><line x1={0} y1={2} x2={20} y2={2} stroke="#2563EB" strokeWidth={2} opacity={0.5} /></svg>
                {series2Label ?? "With Potential"}
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
