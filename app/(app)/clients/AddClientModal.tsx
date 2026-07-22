"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

export default function AddClientModal() {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: "", agency: "", email: "", status: "active" })
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Something went wrong")
      return
    }
    setOpen(false)
    setForm({ name: "", agency: "", email: "", status: "active" })
    router.refresh()
  }

  const inputStyle = {
    width: "100%", padding: "8px 10px", border: "1px solid #ECE7DE",
    borderRadius: 6, fontSize: 13, boxSizing: "border-box" as const,
    fontFamily: "inherit", outline: "none",
  }
  const labelStyle = { fontSize: 11, fontWeight: 600, color: "#6B6760", display: "block", marginBottom: 4 }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{ padding: "8px 18px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
      >
        + Add Client
      </button>

      {open && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 28, width: 420, boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
            <h2 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 22, fontWeight: 600, margin: "0 0 20px", color: "#1A1916" }}>
              New Client
            </h2>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={labelStyle}>Name *</label>
                <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Jane Smith" />
              </div>
              <div>
                <label style={labelStyle}>Agency</label>
                <input style={inputStyle} value={form.agency} onChange={e => setForm(f => ({ ...f, agency: e.target.value }))} placeholder="Acme Agency" />
              </div>
              <div>
                <label style={labelStyle}>Email *</label>
                <input style={inputStyle} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required placeholder="jane@acmeagency.com" />
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <select style={inputStyle} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                </select>
              </div>
              {error && <div style={{ fontSize: 13, color: "#C2410C" }}>{error}</div>}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                <button type="button" onClick={() => setOpen(false)}
                  style={{ padding: "8px 16px", background: "none", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 13, cursor: "pointer", color: "#6B6760" }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  style={{ padding: "8px 18px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}>
                  {saving ? "Saving…" : "Create Client"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
