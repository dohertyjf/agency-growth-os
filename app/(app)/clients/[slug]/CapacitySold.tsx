"use client"
import { ymAdd, ymLabel, capacityByMonth } from "@/lib/calc"

interface Contract {
  id: string
  hoursPerMonth: number
  start: string
  contractedThrough: string | null
  status: string
  type: string
  deliveryStart?: string | null
  deliveryEnd?: string | null
}
interface DeliveryRow { contractId: string; month: string; hours: number }

const r1 = (n: number) => Math.round(n * 10) / 10

// Forward capacity commitment: planned (sold) delivery hours per month vs. team capacity.
// Retainers spread hoursPerMonth across their term; one-offs use their delivery months
// (falling back to hoursPerMonth in the delivery/payment month if none are set).
export default function CapacitySold({ contracts, deliveryMonths, teamCapacity, now }: {
  contracts: Contract[]
  deliveryMonths: DeliveryRow[]
  teamCapacity: number
  now: string
}) {
  const months = Array.from({ length: 12 }, (_, i) => ymAdd(now, i))

  const data = capacityByMonth(contracts, deliveryMonths, months)
  const cm = new Map(data.map(d => [d.month, d]))
  const committed = (m: string) => cm.get(m)?.committed ?? 0
  const pipeline = (m: string) => cm.get(m)?.pipeline ?? 0

  const peak = Math.max(teamCapacity, ...data.map(d => d.committed + d.pipeline), 1)

  const th: React.CSSProperties = { textAlign: "right", padding: "8px 10px", fontSize: 11, fontWeight: 700, color: "#9C9590", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }
  const td: React.CSSProperties = { padding: "8px 10px", textAlign: "right", fontSize: 13, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }

  return (
    <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 20 }}>
      <div style={{ marginBottom: 4 }}>
        <h3 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 20, fontWeight: 600, color: "#1A1916", margin: 0 }}>Capacity Sold</h3>
        <div style={{ fontSize: 12, color: "#9C9590", marginTop: 2 }}>
          Planned delivery hours by month vs. team capacity ({r1(teamCapacity)}h/mo). This is the <strong>work</strong> timeline — separate from when cash is collected.
        </div>
      </div>
      <div style={{ overflowX: "auto", marginTop: 12 }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 620 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #ECE7DE" }}>
              <th style={{ ...th, textAlign: "left" }}>Month</th>
              <th style={th}>Committed</th>
              <th style={th}>Pipeline</th>
              <th style={th}>Capacity</th>
              <th style={th}>Utilization</th>
              <th style={{ ...th, width: "34%" }}></th>
            </tr>
          </thead>
          <tbody>
            {months.map(m => {
              const c = committed(m), p = pipeline(m)
              const util = teamCapacity > 0 ? Math.round((c / teamCapacity) * 100) : null
              const over = teamCapacity > 0 && c > teamCapacity
              const isNow = m === now
              return (
                <tr key={m} style={{ borderBottom: "1px solid #F5F1EC", background: isNow ? "#FDFCFA" : undefined }}>
                  <td style={{ ...td, textAlign: "left", fontWeight: isNow ? 700 : 500, color: "#1A1916" }}>{ymLabel(m)}{isNow && <span style={{ color: "#9C9590", fontWeight: 400 }}> · now</span>}</td>
                  <td style={{ ...td, color: over ? "#C2410C" : "#1A1916", fontWeight: 600 }}>{over && <span style={{ fontSize: 10 }}>▲ </span>}{r1(c)}h</td>
                  <td style={{ ...td, color: p ? "#9C7A3C" : "#C0BAB2" }}>{p ? `+${r1(p)}h` : "—"}</td>
                  <td style={{ ...td, color: "#9C9590" }}>{r1(teamCapacity)}h</td>
                  <td style={{ ...td, color: over ? "#C2410C" : util !== null && util >= 80 ? "#B45309" : "#1F7A4D", fontWeight: 600 }}>{util !== null ? `${util}%` : "—"}</td>
                  <td style={{ padding: "8px 10px" }}>
                    <div style={{ position: "relative", height: 12, background: "#F5F1EC", borderRadius: 6, overflow: "hidden" }}>
                      <div style={{ position: "absolute", inset: 0, width: `${Math.min(100, (c / peak) * 100)}%`, background: over ? "#C2410C" : "#E9532A", borderRadius: 6 }} />
                      <div style={{ position: "absolute", left: `${Math.min(100, (c / peak) * 100)}%`, top: 0, bottom: 0, width: `${Math.min(100, (p / peak) * 100)}%`, background: "#E8C79A" }} />
                      {teamCapacity > 0 && <div title="Team capacity" style={{ position: "absolute", left: `${Math.min(100, (teamCapacity / peak) * 100)}%`, top: -2, bottom: -2, width: 2, background: "#1A1916" }} />}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 11, color: "#9C9590", flexWrap: "wrap" }}>
        <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#E9532A", borderRadius: 2, verticalAlign: "middle", marginRight: 4 }} />Committed (signed)</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#E8C79A", borderRadius: 2, verticalAlign: "middle", marginRight: 4 }} />Pipeline</span>
        <span><span style={{ display: "inline-block", width: 2, height: 12, background: "#1A1916", verticalAlign: "middle", marginRight: 4 }} />Team capacity</span>
      </div>
    </div>
  )
}
