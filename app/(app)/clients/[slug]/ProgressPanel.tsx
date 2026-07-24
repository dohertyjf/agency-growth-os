"use client"
import { useState } from "react"

type Status = "none" | "red" | "yellow" | "green"

interface RoadmapItem {
  key: string
  status: Status
}

interface Props {
  clientId: string
  initialItems: RoadmapItem[]
}

const ROADMAP: Array<{
  key: string
  label: string
  number: string
  children?: Array<{ key: string; label: string; letter: string }>
}> = [
  {
    key: "gather-data",
    label: "Gather data",
    number: "1",
    children: [
      { key: "gather-data-capacity", label: "Capacity", letter: "a" },
      { key: "gather-data-revenue", label: "Revenue", letter: "b" },
      { key: "gather-data-leads", label: "Leads", letter: "c" },
    ],
  },
  { key: "time-audit", label: "Time audit", number: "2" },
  { key: "fix-cash-flow", label: "Fix cash flow", number: "3" },
  { key: "identify-icp", label: "Identify ICP", number: "4" },
  { key: "messaging-positioning", label: "Create messaging and positioning", number: "5" },
  { key: "start-marketing", label: "Start marketing", number: "6" },
  { key: "fix-offer", label: "Fix offer (packaging and pricing)", number: "7" },
  { key: "contracts", label: "Contracts", number: "8" },
  { key: "fix-sales", label: "Fix sales", number: "9" },
  { key: "hire-admin", label: "Hire admin", number: "10" },
  { key: "increase-marketing", label: "Increase marketing volume", number: "11" },
  { key: "hiring", label: "Hiring", number: "12" },
]

const STATUS_CONFIG: Record<Exclude<Status, "none">, { bg: string; ring: string; label: string }> = {
  red:    { bg: "#DC2626", ring: "#DC2626", label: "R" },
  yellow: { bg: "#D97706", ring: "#D97706", label: "Y" },
  green:  { bg: "#16A34A", ring: "#16A34A", label: "G" },
}

function StatusPicker({ itemKey, status, onChange }: { itemKey: string; status: Status; onChange: (key: string, s: Status) => void }) {
  return (
    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
      {(["red", "yellow", "green"] as const).map(s => {
        const cfg = STATUS_CONFIG[s]
        const active = status === s
        return (
          <button
            key={s}
            onClick={() => onChange(itemKey, active ? "none" : s)}
            title={s.charAt(0).toUpperCase() + s.slice(1)}
            style={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              border: active ? `2px solid ${cfg.ring}` : "2px solid #E5E7EB",
              background: active ? cfg.bg : "#F9FAFB",
              color: active ? "#fff" : "#D1D5DB",
              fontSize: 10,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.12s",
              padding: 0,
            }}
          >
            {cfg.label}
          </button>
        )
      })}
    </div>
  )
}

export default function ProgressPanel({ clientId, initialItems }: Props) {
  const [statuses, setStatuses] = useState<Record<string, Status>>(() => {
    const map: Record<string, Status> = {}
    for (const item of initialItems) map[item.key] = item.status
    return map
  })

  async function handleChange(key: string, status: Status) {
    setStatuses(prev => ({ ...prev, [key]: status }))
    await fetch(`/api/clients/${clientId}/roadmap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, status }),
    })
  }

  const getStatus = (key: string): Status => statuses[key] ?? "none"

  return (
    <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #F5F1EC", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#1A1916" }}>Growth Roadmap</div>
          <div style={{ fontSize: 12, color: "#9C9590", marginTop: 2 }}>Mark each area to see where to dive in next.</div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {(["red", "yellow", "green"] as const).map(s => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#9C9590" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: STATUS_CONFIG[s].bg }} />
              {s === "red" ? "Needs work" : s === "yellow" ? "In progress" : "Good"}
            </div>
          ))}
        </div>
      </div>

      <div>
        {ROADMAP.map((step, i) => (
          <div key={step.key} style={{ borderBottom: i < ROADMAP.length - 1 ? "1px solid #F5F1EC" : "none" }}>
            {step.children ? (
              <>
                <div style={{ padding: "12px 20px 4px", display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#9C9590", minWidth: 20, textAlign: "right" }}>{step.number}.</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#1A1916", flex: 1 }}>{step.label}</span>
                </div>
                {step.children.map((child, ci) => (
                  <div key={child.key} style={{ padding: "6px 20px 6px 52px", display: "flex", alignItems: "center", gap: 12, background: ci % 2 === 0 ? "#FDFCFA" : "#fff" }}>
                    <span style={{ fontSize: 11, color: "#C4BFBA", minWidth: 14 }}>{child.letter}.</span>
                    <span style={{ fontSize: 13, color: "#4B4744", flex: 1 }}>{child.label}</span>
                    <StatusPicker itemKey={child.key} status={getStatus(child.key)} onChange={handleChange} />
                  </div>
                ))}
                <div style={{ height: 8 }} />
              </>
            ) : (
              <div style={{ padding: "12px 20px", display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#9C9590", minWidth: 20, textAlign: "right" }}>{step.number}.</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#1A1916", flex: 1 }}>{step.label}</span>
                <StatusPicker itemKey={step.key} status={getStatus(step.key)} onChange={handleChange} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
