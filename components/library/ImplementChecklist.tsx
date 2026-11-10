"use client"
import { useState } from "react"

// The "Implement this" steps. Clients tick them off and it's saved to their
// profile; for the coach (no client) ticks are local only.
export default function ImplementChecklist({ trainingId, steps, initialDone, canTrack }: {
  trainingId: string
  steps: string[]
  initialDone: number[]
  canTrack: boolean
}) {
  const [done, setDone] = useState<number[]>(initialDone.filter(i => i < steps.length))

  async function toggle(i: number) {
    const next = done.includes(i) ? done.filter(x => x !== i) : [...done, i]
    setDone(next)
    if (!canTrack) return
    await fetch(`/api/library/trainings/${trainingId}/progress`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doneSteps: next }),
    })
  }

  return (
    <div>
      {steps.map((s, i) => {
        const checked = done.includes(i)
        return (
          <label key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "9px 0", borderBottom: i < steps.length - 1 ? "1px solid #F5F1EC" : "none", cursor: "pointer" }}>
            <input type="checkbox" checked={checked} onChange={() => toggle(i)} style={{ accentColor: "#E9532A", marginTop: 3, width: 16, height: 16, flexShrink: 0 }} />
            <span style={{ fontSize: 14, lineHeight: 1.5, color: checked ? "#9C9590" : "#1A1916", textDecoration: checked ? "line-through" : "none" }}>{s}</span>
          </label>
        )
      })}
      <div style={{ fontSize: 12, color: done.length === steps.length ? "#166534" : "#9C9590", marginTop: 10, fontWeight: done.length === steps.length ? 600 : 400 }}>
        {done.length === steps.length ? "✓ All steps done — nice work." : `${done.length} of ${steps.length} done`}
        {!canTrack && " · progress is saved for client logins only"}
      </div>
    </div>
  )
}
