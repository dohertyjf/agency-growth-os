"use client"
import { useState } from "react"

interface Program { id: string; name: string; isGroup: boolean }

export default function ProgramAssignPanel({
  clientId, programs, initialProgramIds,
}: { clientId: string; programs: Program[]; initialProgramIds: string[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialProgramIds))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function toggle(programId: string) {
    const next = new Set(selected)
    if (next.has(programId)) next.delete(programId)
    else next.add(programId)
    setSelected(next)
    setSaving(true)
    setSaved(false)
    const res = await fetch(`/api/clients/${clientId}/programs`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ programIds: [...next] }),
    })
    setSaving(false)
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 1500) }
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 24, marginTop: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#9C9590", letterSpacing: "0.05em", textTransform: "uppercase" }}>
          Programs
        </div>
        {saving && <span style={{ fontSize: 12, color: "#9C9590" }}>Saving…</span>}
        {saved && <span style={{ fontSize: 12, color: "#166534", fontWeight: 600 }}>Saved ✓</span>}
      </div>
      <p style={{ fontSize: 13, color: "#6B6760", margin: "0 0 16px", lineHeight: 1.5 }}>
        Which programs this client is in. Being in a <strong>group</strong> program also gives them that program&apos;s group-call recaps. Manage the list of programs on the Programs page.
      </p>

      {programs.length === 0 ? (
        <p style={{ fontSize: 13, color: "#9C9590", margin: 0 }}>No programs yet — create them on the Programs page first.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {programs.map(p => (
            <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#1A1916", cursor: "pointer" }}>
              <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} style={{ accentColor: "#E9532A" }} />
              {p.name}
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 8, background: p.isGroup ? "#EDE9FE" : "#F1F0EC", color: p.isGroup ? "#6D28D9" : "#9C9590", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {p.isGroup ? "Group" : "1:1"}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
