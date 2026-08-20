"use client"
import { useState } from "react"
import { ymAdd, ymLabel, capacityByMonth, type CapacityContract, type DeliveryRow } from "@/lib/calc"

const r1 = (n: number) => Math.round(n * 10) / 10

// Delivery hours sold per month vs. team capacity (people hours). Hover a month
// to see the gap either way — oversold (red) or headroom (green).
export default function CapacitySoldChart({ contracts, deliveryMonths, teamCapacity, now }: {
  contracts: CapacityContract[]
  deliveryMonths: DeliveryRow[]
  teamCapacity: number
  now: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const months = Array.from({ length: 12 }, (_, i) => ymAdd(now, i))
  const data = capacityByMonth(contracts, deliveryMonths, months)
  const max = Math.max(teamCapacity, ...data.map(d => d.committed + d.pipeline), 1) * 1.1

  const W = 760, H = 220, padL = 40, padR = 14, padT = 14, padB = 30
  const plotW = W - padL - padR, plotH = H - padT - padB
  const colW = plotW / 12
  const barW = colW * 0.56
  const yFor = (v: number) => padT + plotH * (1 - v / max)
  const baseY = yFor(0)
  const capY = yFor(teamCapacity)
  const colX = (i: number) => padL + colW * i + colW / 2

  const anyData = data.some(d => d.committed + d.pipeline > 0)

  return (
    <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <div>
          <h3 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 20, fontWeight: 600, color: "#1A1916", margin: 0 }}>Capacity Sold</h3>
          <div style={{ fontSize: 12, color: "#9C9590", marginTop: 2 }}>Delivery hours sold per month vs. team capacity ({r1(teamCapacity)}h/mo)</div>
        </div>
        <div style={{ display: "flex", gap: 14, fontSize: 11, color: "#9C9590", flexWrap: "wrap" }}>
          <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#E9532A", borderRadius: 2, verticalAlign: "middle", marginRight: 4 }} />Committed</span>
          <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#E8C79A", borderRadius: 2, verticalAlign: "middle", marginRight: 4 }} />Pipeline</span>
          <span><span style={{ display: "inline-block", width: 12, height: 2, background: "#1A1916", verticalAlign: "middle", marginRight: 4 }} />Capacity</span>
        </div>
      </div>

      {!anyData ? (
        <div style={{ fontSize: 13, color: "#9C9590", padding: "28px 0", textAlign: "center" }}>No delivery hours scheduled yet. Set hours in a project&apos;s Schedule.</div>
      ) : (
        <div style={{ position: "relative", marginTop: 12 }}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
            <line x1={padL} y1={baseY} x2={W - padR} y2={baseY} stroke="#ECE7DE" strokeWidth={1} />
            <text x={padL - 6} y={baseY + 3} textAnchor="end" fontSize={9} fill="#B0A9A0">0</text>
            <text x={padL - 6} y={yFor(max) + 8} textAnchor="end" fontSize={9} fill="#B0A9A0">{r1(max)}h</text>

            {data.map((d, i) => {
              const over = teamCapacity > 0 && d.committed > teamCapacity
              const cTop = yFor(d.committed)
              const pTop = yFor(d.committed + d.pipeline)
              const x = colX(i) - barW / 2
              return (
                <g key={d.month}>
                  {d.pipeline > 0 && <rect x={x} y={pTop} width={barW} height={Math.max(0, cTop - pTop)} fill="#E8C79A" rx={2} />}
                  <rect x={x} y={cTop} width={barW} height={Math.max(0, baseY - cTop)} fill={over ? "#C2410C" : "#E9532A"} rx={2} opacity={hover === null || hover === i ? 1 : 0.55} />
                  <text x={colX(i)} y={H - padB + 13} textAnchor="middle" fontSize={9} fill={d.month === now ? "#1A1916" : "#B0A9A0"} fontWeight={d.month === now ? 700 : 400}>{ymLabel(d.month).split(" ")[0]}</text>
                </g>
              )
            })}

            {teamCapacity > 0 && <line x1={padL} y1={capY} x2={W - padR} y2={capY} stroke="#1A1916" strokeWidth={1.5} strokeDasharray="4 3" />}

            {data.map((d, i) => (
              <rect key={`h${d.month}`} x={padL + colW * i} y={padT} width={colW} height={plotH}
                fill="transparent" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{ cursor: "default" }} />
            ))}
          </svg>

          {hover !== null && (() => {
            const d = data[hover]
            const gap = teamCapacity - d.committed
            const over = gap < 0
            const leftPct = (colX(hover) / W) * 100
            return (
              <div style={{ position: "absolute", left: `${leftPct}%`, top: 0, transform: `translateX(-50%) translateY(-6px)`, pointerEvents: "none", background: "#1A1916", color: "#fff", borderRadius: 8, padding: "8px 11px", fontSize: 11, whiteSpace: "nowrap", boxShadow: "0 4px 16px rgba(0,0,0,0.2)", zIndex: 5 }}>
                <div style={{ fontWeight: 700, marginBottom: 3 }}>{ymLabel(d.month)}</div>
                <div style={{ color: "#F0C9BB" }}>Committed {r1(d.committed)}h</div>
                {d.pipeline > 0 && <div style={{ color: "#E8C79A" }}>+ Pipeline {r1(d.pipeline)}h</div>}
                <div style={{ color: "#C9C4BC" }}>Capacity {r1(teamCapacity)}h</div>
                <div style={{ marginTop: 3, fontWeight: 700, color: over ? "#FF8A66" : "#7EE0A6" }}>
                  {teamCapacity <= 0 ? "Set team hours" : over ? `Oversold ${r1(-gap)}h` : `Headroom ${r1(gap)}h`}
                </div>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
