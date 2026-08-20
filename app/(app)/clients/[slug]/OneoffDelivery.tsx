"use client"
import { useState, useEffect } from "react"
import { ymLabel } from "@/lib/calc"

function monthsInRange(start: string, end: string): string[] {
  if (!start || !end || start > end) return start ? [start] : []
  const out: string[] = []
  let [y, m] = start.split("-").map(Number)
  const [ey, em] = end.split("-").map(Number)
  let guard = 0
  while ((y < ey || (y === ey && m <= em)) && guard++ < 120) {
    out.push(`${y}-${String(m).padStart(2, "0")}`)
    m++; if (m > 12) { m = 1; y++ }
  }
  return out
}

const r1 = (n: number) => Math.round(n * 10) / 10

// Editor for a one-off's delivery window + planned hours by month (capacity sold).
// Payment stays on the deal's own month; this is the *work* timeline.
export default function OneoffDelivery({ contractId, paymentMonth, initialStart, initialEnd, onSaved }: {
  contractId: string
  paymentMonth: string
  initialStart: string | null
  initialEnd: string | null
  onSaved?: (deliveryStart: string, deliveryEnd: string) => void
}) {
  const [dStart, setDStart] = useState(initialStart || paymentMonth)
  const [dEnd, setDEnd] = useState(initialEnd || initialStart || paymentMonth)
  const [hours, setHours] = useState<Record<string, string>>({})
  const [total, setTotal] = useState("")
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)

  useEffect(() => {
    fetch(`/api/contracts/${contractId}/delivery`).then(r => r.ok ? r.json() : []).then((rows: { month: string; hours: number }[]) => {
      const map: Record<string, string> = {}
      rows.forEach(rw => { map[rw.month] = String(rw.hours) })
      setHours(map)
      if (rows.length) setTotal(String(r1(rows.reduce((s, rw) => s + rw.hours, 0))))
      setLoaded(true)
    }).catch(() => setLoaded(true))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const months = monthsInRange(dStart, dEnd)
  const sum = months.reduce((s, m) => s + (parseFloat(hours[m]) || 0), 0)

  function splitEvenly() {
    const t = parseFloat(total)
    if (!t || !months.length) return
    const per = r1(t / months.length)
    const map: Record<string, string> = {}
    months.forEach((m, i) => { map[m] = String(i === months.length - 1 ? r1(t - per * (months.length - 1)) : per) })
    setHours(map)
  }

  async function save() {
    setSaving(true)
    await fetch(`/api/contracts/${contractId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliveryStart: dStart || null, deliveryEnd: dEnd || null }),
    })
    await fetch(`/api/contracts/${contractId}/delivery`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ months: months.map(m => ({ month: m, hours: parseFloat(hours[m]) || 0 })) }),
    })
    setSaving(false)
    setSavedMsg(true); setTimeout(() => setSavedMsg(false), 1800)
    onSaved?.(dStart, dEnd)
  }

  const inp: React.CSSProperties = { padding: "6px 8px", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 12, fontFamily: "inherit", outline: "none", background: "#fff", color: "#1A1916", width: "100%", boxSizing: "border-box" }
  const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 600, color: "#6B6760", display: "block", marginBottom: 3 }

  return (
    <div style={{ border: "1px solid #ECE7DE", borderRadius: 8, padding: 12, background: "#FBFAF7", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#1A1916" }}>
        Delivery <span style={{ fontWeight: 400, color: "#9C9590" }}>· work timeline (capacity), separate from payment ({ymLabel(paymentMonth)})</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div><label style={lbl}>Delivery start</label><input style={inp} type="month" value={dStart} onChange={e => setDStart(e.target.value)} /></div>
        <div><label style={lbl}>Delivery end</label><input style={inp} type="month" value={dEnd} onChange={e => setDEnd(e.target.value)} /></div>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
        <div style={{ flex: 1 }}><label style={lbl}>Total sold hours</label><input style={inp} type="number" min={0} step="any" value={total} onChange={e => setTotal(e.target.value)} placeholder="e.g. 60" /></div>
        <button type="button" onClick={splitEvenly}
          style={{ padding: "7px 12px", background: "none", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 12, cursor: "pointer", color: "#6B6760", whiteSpace: "nowrap" }}>
          Split evenly →
        </button>
      </div>
      {loaded && months.length > 0 && (
        <div>
          <label style={lbl}>Hours per delivery month <span style={{ color: "#C0BAB2", fontWeight: 400 }}>(shift as needed)</span></label>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {months.map(m => (
              <div key={m} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: "#6B6760", width: 90 }}>{ymLabel(m)}</span>
                <input style={{ ...inp, width: 90 }} type="number" min={0} step="any" value={hours[m] ?? ""} placeholder="0"
                  onChange={e => setHours(h => ({ ...h, [m]: e.target.value }))} />
                <span style={{ fontSize: 11, color: "#9C9590" }}>hrs</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "#9C9590", marginTop: 6 }}>Allocated: <strong style={{ color: "#1A1916" }}>{r1(sum)}h</strong>{total && ` of ${r1(parseFloat(total) || 0)}h`}</div>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button type="button" onClick={save} disabled={saving}
          style={{ padding: "7px 14px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          {saving ? "Saving…" : "Save delivery"}
        </button>
        {savedMsg && <span style={{ fontSize: 12, color: "#1F7A4D", fontWeight: 600 }}>Saved ✓</span>}
      </div>
    </div>
  )
}
