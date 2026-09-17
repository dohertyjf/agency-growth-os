"use client"
import { useState } from "react"

// Shown across the top while the coach is using the app as a client.
export default function ImpersonationBar({ asName, coachName }: { asName: string; coachName: string | null }) {
  const [busy, setBusy] = useState(false)

  async function switchBack() {
    setBusy(true)
    const res = await fetch("/api/auth/impersonate", { method: "DELETE" })
    if (res.ok) {
      // Full navigation so nothing prefetched under the client session is reused.
      window.location.assign("/clients")
    } else {
      setBusy(false)
    }
  }

  return (
    <div style={{ background: "#1A1916", color: "#FBFAF7", fontSize: 13, padding: "8px 20px", display: "flex", alignItems: "center", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>
      <span>You are using August as <strong>{asName}</strong>.</span>
      <button
        onClick={switchBack}
        disabled={busy}
        style={{ background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 13, fontWeight: 600, cursor: busy ? "default" : "pointer", fontFamily: "inherit", opacity: busy ? 0.7 : 1 }}
      >
        {busy ? "Switching…" : `Switch back to ${coachName ?? "coach"}`}
      </button>
    </div>
  )
}
