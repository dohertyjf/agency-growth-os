"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

type Status = "active" | "paused" | "archived"

interface Props {
  clientId: string
  initialStatus: Status
  initialStartDate: string | null
  initialEndDate: string | null
}

const STATUS_LABELS: Record<Status, string> = {
  active: "Active",
  paused: "Paused",
  archived: "Archived",
}

const STATUS_COLORS: Record<Status, { bg: string; text: string }> = {
  active: { bg: "#DCFCE7", text: "#166534" },
  paused: { bg: "#FEF9C3", text: "#854D0E" },
  archived: { bg: "#F3F4F6", text: "#6B7280" },
}

export default function ClientStatusPanel({ clientId, initialStatus, initialStartDate, initialEndDate }: Props) {
  const [status, setStatus] = useState<Status>(initialStatus)
  const [startDate, setStartDate] = useState(initialStartDate ?? "")
  const [endDate, setEndDate] = useState(initialEndDate ?? "")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaved(false)
    const res = await fetch(`/api/clients/${clientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        startDate: startDate || null,
        endDate: endDate || null,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json()
      setError(typeof d.error === "string" ? d.error : "Failed to save")
      return
    }
    setSaved(true)
    router.refresh()
    setTimeout(() => setSaved(false), 2000)
  }

  const colors = STATUS_COLORS[status]
  const inputStyle = {
    padding: "7px 10px", border: "1px solid #ECE7DE", borderRadius: 6,
    fontSize: 13, fontFamily: "inherit", outline: "none", background: "#fff",
  }
  const labelStyle = { fontSize: 11, fontWeight: 600 as const, color: "#6B6760", display: "block" as const, marginBottom: 4 }

  return (
    <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h3 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 18, fontWeight: 600, color: "#1A1916", margin: 0 }}>
          Client Status
        </h3>
        <span style={{ padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 600, background: colors.bg, color: colors.text }}>
          {STATUS_LABELS[status]}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, alignItems: "end" }}>
        <div>
          <label style={labelStyle}>Status</label>
          <select style={{ ...inputStyle, width: "100%" }} value={status} onChange={e => setStatus(e.target.value as Status)}>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Start Date</label>
          <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" as const }} type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>End Date</label>
          <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" as const }} type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
      </div>

      {error && <div style={{ fontSize: 13, color: "#C2410C", marginTop: 12 }}>{error}</div>}

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: "8px 18px", background: "#E9532A", color: "#fff", border: "none",
            borderRadius: 6, fontSize: 13, fontWeight: 700,
            cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {saved && <span style={{ fontSize: 13, color: "#166534" }}>Saved!</span>}
      </div>
    </div>
  )
}
