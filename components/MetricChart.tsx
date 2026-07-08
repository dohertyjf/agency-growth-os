"use client"
import { useState } from "react"

export interface ChartPoint {
  label: string
  value: number
  projected?: boolean
}

interface Props {
  points: ChartPoint[]
  format: "currency" | "percent" | "number"
  label: string
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
const VW = 620
const VH = 210

export default function MetricChart({ points, format, label }: Props) {
  const [hover, setHover] = useState<number | null>(null)

  if (!points.length) {
    return (
      <div style={{ height: VH, display: "flex", alignItems: "center", justifyContent: "center", color: "#9C9590", fontSize: 14 }}>
        No data to display
      </div>
    )
  }

  const plotW = VW - PAD.left - PAD.right
  const plotH = VH - PAD.top - PAD.bottom

  const vals = points.map(p => p.value)
  const dataMin = Math.min(...vals)
  const dataMax = Math.max(...vals)
  const spread = dataMax - dataMin || Math.abs(dataMax) || 1
  const yMin = dataMin - spread * 0.12
  const yMax = dataMax + spread * 0.12
  const yRange = yMax - yMin

  const toX = (i: number) =>
    points.length === 1
      ? PAD.left + plotW / 2
      : PAD.left + (i / (points.length - 1)) * plotW

  const toY = (v: number) => PAD.top + plotH - ((v - yMin) / yRange) * plotH

  // Y axis ticks
  const tickCount = 4
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => yMin + (yRange * i) / tickCount)

  // Build SVG paths
  const histPairs: { i: number; p: ChartPoint }[] = []
  const projPairs: { i: number; p: ChartPoint }[] = []
  points.forEach((p, i) => {
    if (p.projected) projPairs.push({ i, p })
    else histPairs.push({ i, p })
  })

  const makePath = (pairs: { i: number; p: ChartPoint }[]) =>
    pairs.map(({ i, p }, j) => `${j === 0 ? "M" : "L"} ${toX(i)},${toY(p.value)}`).join(" ")

  const histPath = makePath(histPairs)

  // Projected path starts from last historical point
  let projPath = ""
  if (projPairs.length && histPairs.length) {
    const last = histPairs[histPairs.length - 1]
    projPath = `M ${toX(last.i)},${toY(last.p.value)} ` + projPairs.map(({ i, p }) => `L ${toX(i)},${toY(p.value)}`).join(" ")
  } else if (projPairs.length) {
    projPath = makePath(projPairs)
  }

  const colW = points.length > 1 ? plotW / points.length : plotW

  return (
    <div style={{ position: "relative" }}>
      <div style={{ fontSize: 11, color: "#9C9590", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 4 }}>
        {label}
      </div>
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        style={{ width: "100%", height: VH, display: "block" }}
        onMouseLeave={() => setHover(null)}
      >
        {/* Grid lines + Y labels */}
        {yTicks.map((tick, i) => (
          <g key={i}>
            <line
              x1={PAD.left} y1={toY(tick)}
              x2={VW - PAD.right} y2={toY(tick)}
              stroke="#ECE7DE" strokeWidth={1}
            />
            <text x={PAD.left - 8} y={toY(tick) + 4} textAnchor="end" fontSize={10} fill="#9C9590">
              {fmt(tick, format)}
            </text>
          </g>
        ))}

        {/* X labels */}
        {points.map((p, i) => (
          <text key={i} x={toX(i)} y={VH - 6} textAnchor="middle" fontSize={10} fill={p.projected ? "#C0BAB2" : "#6B6760"}>
            {p.label}
          </text>
        ))}

        {/* Historical line */}
        {histPath && (
          <path d={histPath} fill="none" stroke="#E9532A" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        )}

        {/* Projected line */}
        {projPath && (
          <path d={projPath} fill="none" stroke="#E9532A" strokeWidth={2} strokeDasharray="6,4" strokeLinejoin="round" strokeLinecap="round" opacity={0.6} />
        )}

        {/* Dots */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={toX(i)}
            cy={toY(p.value)}
            r={hover === i ? 5 : 3.5}
            fill={p.projected ? "#fff" : "#E9532A"}
            stroke="#E9532A"
            strokeWidth={2}
          />
        ))}

        {/* Hover hit areas */}
        {points.map((_, i) => (
          <rect
            key={i}
            x={toX(i) - colW / 2}
            y={PAD.top}
            width={colW}
            height={plotH}
            fill="transparent"
            style={{ cursor: "crosshair" }}
            onMouseEnter={() => setHover(i)}
          />
        ))}

        {/* Tooltip */}
        {hover !== null && (() => {
          const p = points[hover]
          const tx = toX(hover)
          const ty = toY(p.value)
          const flip = tx > VW * 0.65
          const ttX = flip ? tx - 84 : tx + 10
          return (
            <g>
              <line x1={tx} y1={PAD.top} x2={tx} y2={PAD.top + plotH} stroke="#D0C9BF" strokeWidth={1} strokeDasharray="3,2" />
              <rect x={ttX} y={ty - 14} width={78} height={22} rx={4} fill="#1A1916" />
              <text x={ttX + 39} y={ty + 2} textAnchor="middle" fontSize={11} fill="#fff" fontWeight="600">
                {fmt(p.value, format)}
              </text>
            </g>
          )
        })()}
      </svg>

      {projPairs.length > 0 && (
        <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#9C9590", marginTop: 4 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <svg width={20} height={4}><line x1={0} y1={2} x2={20} y2={2} stroke="#E9532A" strokeWidth={2} /></svg>
            Actual
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <svg width={20} height={4}><line x1={0} y1={2} x2={20} y2={2} stroke="#E9532A" strokeWidth={2} strokeDasharray="4,3" opacity={0.6} /></svg>
            Projected
          </span>
        </div>
      )}
    </div>
  )
}
