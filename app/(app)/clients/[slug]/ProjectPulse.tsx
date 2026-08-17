"use client"
import { useState } from "react"

export interface Pulse { contractId: string; month: string; score: number; note: string | null }

const now = new Date().toISOString().slice(0, 7)

// 1–5 pulse → color. ≤2 red · 3 amber · 4–5 green.
export function pulseColor(score: number): { fg: string; bg: string } {
  if (score <= 2) return { fg: "#C2410C", bg: "#FBEAE4" }
  if (score === 3) return { fg: "#B45309", bg: "#FEF3C7" }
  return { fg: "#166534", bg: "#DCFCE7" }
}

// Compact pulse badge + inline editor for one project's current-month pulse.
export default function ProjectPulse({ contractId, current, prev, onSaved }: {
  contractId: string
  current?: Pulse
  prev?: Pulse
  onSaved: (pulse: Pulse) => void
}) {
  const [editing, setEditing] = useState(false)
  const [score, setScore] = useState(current?.score ?? 3)
  const [note, setNote] = useState(current?.note ?? "")
  const [saving, setSaving] = useState(false)

  function open() {
    setScore(current?.score ?? 3)
    setNote(current?.note ?? "")
    setEditing(true)
  }

  async function save() {
    setSaving(true)
    const res = await fetch(`/api/contracts/${contractId}/pulse`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: now, score, note: note.trim() || undefined }),
    })
    setSaving(false)
    if (!res.ok) return
    onSaved({ contractId, month: now, score, note: note.trim() || null })
    setEditing(false)
  }

  const declining = current && prev && current.score < prev.score
  const col = current ? pulseColor(current.score) : null

  if (!editing) {
    return (
      <button onClick={open} title="Project pulse this month"
        style={{ display: "inline-flex", alignItems: "center", gap: 3, border: current ? "none" : "1px dashed #E0DAD0", background: current ? col!.bg : "none", color: current ? col!.fg : "#9C9590", borderRadius: 20, padding: "2px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
        {current ? <>Pulse {current.score}/5{declining && <span title="Down vs last month" style={{ fontSize: 10 }}> ▼</span>}</> : "+ Pulse"}
      </button>
    )
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <span style={{ display: "inline-flex", gap: 3 }}>
        {[1, 2, 3, 4, 5].map(n => {
          const sel = score === n
          const c = pulseColor(n)
          return (
            <button key={n} type="button" onClick={() => setScore(n)}
              style={{ width: 26, height: 26, borderRadius: 6, border: sel ? `2px solid ${c.fg}` : "1px solid #ECE7DE", background: sel ? c.bg : "#fff", color: sel ? c.fg : "#9C9590", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              {n}
            </button>
          )
        })}
      </span>
      <input value={note} onChange={e => setNote(e.target.value)} placeholder="note (optional)"
        style={{ width: 130, padding: "5px 8px", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 12, fontFamily: "inherit", outline: "none" }} />
      <button type="button" onClick={save} disabled={saving}
        style={{ padding: "5px 11px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{saving ? "…" : "Save"}</button>
      <button type="button" onClick={() => setEditing(false)}
        style={{ padding: "5px 8px", background: "none", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 12, cursor: "pointer", color: "#6B6760" }}>×</button>
    </span>
  )
}
