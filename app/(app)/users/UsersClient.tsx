"use client"
import { useState } from "react"
import Link from "next/link"

export interface UserRow {
  clientId: string
  slug: string | null
  name: string
  agency: string | null
  email: string
  clientStatus: string
  programs: string[]
  login: "active" | "invited" | "deactivated" | "none"
  since: string | null
  hasPassword: boolean
}

const LOGIN: Record<UserRow["login"], { label: string; bg: string; text: string }> = {
  active: { label: "Active", bg: "#DCFCE7", text: "#166534" },
  invited: { label: "Invited", bg: "#FEF3C7", text: "#92400E" },
  deactivated: { label: "Deactivated", bg: "#F3F4F6", text: "#6B7280" },
  none: { label: "No login", bg: "#FBFAF7", text: "#9C9590" },
}

type Filter = "all" | "active" | "deactivated" | "none"
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Can sign in" },
  { key: "deactivated", label: "Deactivated" },
  { key: "none", label: "No login" },
]

const th: React.CSSProperties = { textAlign: "left", fontSize: 11, fontWeight: 600, color: "#9C9590", padding: "8px 12px", borderBottom: "1px solid #ECE7DE", whiteSpace: "nowrap" }
const td: React.CSSProperties = { padding: "10px 12px", fontSize: 13, color: "#1A1916", borderBottom: "1px solid #F5F1EC", verticalAlign: "middle" }
const btn: React.CSSProperties = { padding: "5px 12px", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 12, fontWeight: 600, background: "#fff", color: "#4A4640", cursor: "pointer", whiteSpace: "nowrap", textDecoration: "none", display: "inline-block" }

export default function UsersClient({ initialRows }: { initialRows: UserRow[] }) {
  const [rows, setRows] = useState(initialRows)
  const [filter, setFilter] = useState<Filter>("all")
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const matches = (r: UserRow) =>
    filter === "all" ? true
    : filter === "active" ? r.login === "active" || r.login === "invited"
    : r.login === filter
  const shown = rows.filter(matches)
  const count = (f: Filter) => rows.filter(r => f === "all" || (f === "active" ? r.login === "active" || r.login === "invited" : r.login === f)).length

  async function setActive(r: UserRow, active: boolean) {
    if (!active && !confirm(`Deactivate ${r.name}'s login? They won't be able to sign in, but their profile and data are kept. You can reactivate anytime.`)) return
    setBusy(r.clientId); setError(null)
    const res = await fetch(`/api/clients/${r.clientId}/invite`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active }),
    })
    setBusy(null)
    if (!res.ok) { setError(`Couldn't update ${r.name} — try again.`); return }
    // Reactivating someone who never set a password puts them back to "invited".
    setRows(prev => prev.map(x => x.clientId !== r.clientId ? x : { ...x, login: active ? (x.hasPassword ? "active" : "invited") : "deactivated" }))
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 28, fontWeight: 600, margin: "0 0 4px", color: "#1A1916" }}>Users</h1>
        <p style={{ fontSize: 13, color: "#9C9590", margin: 0 }}>Every client and their login. Deactivate someone who&apos;s no longer a client — they can&apos;t sign in, but their profile and data are kept — and reactivate them if they come back.</p>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            style={{ padding: "5px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer", border: `1px solid ${filter === f.key ? "#E9532A" : "#ECE7DE"}`, background: filter === f.key ? "#FDF1EC" : "#fff", color: filter === f.key ? "#E9532A" : "#4A4640" }}>
            {f.label} <span style={{ color: "#9C9590" }}>{count(f.key)}</span>
          </button>
        ))}
      </div>

      {error && <div style={{ fontSize: 13, color: "#B23A1B", marginBottom: 10 }}>{error}</div>}

      <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
          <thead>
            <tr><th style={th}>Client</th><th style={th}>Login email</th><th style={th}>Programs</th><th style={th}>Login</th><th style={{ ...th, textAlign: "right" }}></th></tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr><td colSpan={5} style={{ ...td, color: "#9C9590" }}>Nobody here.</td></tr>
            )}
            {shown.map(r => {
              const s = LOGIN[r.login]
              const profile = r.slug ? `/clients/${r.slug}` : null
              return (
                <tr key={r.clientId} style={{ opacity: r.login === "deactivated" ? 0.7 : 1 }}>
                  <td style={td}>
                    {profile ? <Link href={profile} style={{ color: "#1A1916", fontWeight: 600, textDecoration: "none" }}>{r.name}</Link> : <strong>{r.name}</strong>}
                    {r.agency && <div style={{ fontSize: 11, color: "#9C9590" }}>{r.agency}</div>}
                  </td>
                  <td style={{ ...td, color: "#6B6760" }}>{r.email}</td>
                  <td style={{ ...td, fontSize: 12, color: "#6B6760" }}>{r.programs.length ? r.programs.join(", ") : <span style={{ color: "#C0BAB2" }}>—</span>}</td>
                  <td style={td}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: s.bg, color: s.text, whiteSpace: "nowrap" }}>{s.label}</span>
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>
                    {r.login === "none" ? (
                      profile && <Link href={`${profile}/goals`} style={btn} title="Invite them from their Settings tab">Set up login</Link>
                    ) : r.login === "deactivated" ? (
                      <button onClick={() => setActive(r, true)} disabled={busy === r.clientId} style={{ ...btn, color: "#166534", borderColor: "#BBEFCE" }}>Reactivate</button>
                    ) : (
                      <button onClick={() => setActive(r, false)} disabled={busy === r.clientId} style={btn}>Deactivate</button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
