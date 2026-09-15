"use client"
import { useState } from "react"
import { signOut } from "next-auth/react"

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", border: "1px solid #ECE7DE", borderRadius: 6,
  fontSize: 14, background: "#FBFAF7", color: "#1A1916", boxSizing: "border-box",
}
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "#1A1916",
}

export default function AccountMenu({ userName }: { userName: string | null | undefined }) {
  const [open, setOpen] = useState(false)
  const [modal, setModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)

  const initials = (userName ?? "?")
    .split(" ")
    .map((p: string) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const currentPassword = fd.get("current") as string
    const newPassword = fd.get("next") as string
    const confirm = fd.get("confirm") as string
    if (newPassword !== confirm) { setError("New passwords do not match"); return }
    setLoading(true)
    setError("")
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    })
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) { setError(data.error || "Something went wrong"); return }
    setDone(true)
  }

  function closeModal() {
    setModal(false)
    setError("")
    setDone(false)
  }

  return (
    <>
      <div style={{ position: "relative" }}>
        <button
          onClick={() => setOpen(o => !o)}
          title="Account"
          style={{ display: "flex", alignItems: "center", background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 8, flexShrink: 0 }}
        >
          <div style={{ width: 30, height: 30, background: "#1A1916", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 700 }}>
            {initials}
          </div>
        </button>

        {open && (
          <>
            {/* click-away backdrop */}
            <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 45 }} />
            <div style={{ position: "absolute", right: 0, top: 40, background: "#fff", border: "1px solid #ECE7DE", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.08)", minWidth: 180, zIndex: 46, overflow: "hidden" }}>
              <button
                onClick={() => { setOpen(false); setModal(true) }}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "11px 16px", fontSize: 14, color: "#1A1916", background: "none", border: "none", cursor: "pointer" }}
              >
                Change password
              </button>
              <div style={{ borderTop: "1px solid #F5F1EC" }} />
              <button
                onClick={() => signOut({ callbackUrl: "/auth/signin" })}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "11px 16px", fontSize: 14, color: "#9C9590", background: "none", border: "none", cursor: "pointer" }}
              >
                Sign out
              </button>
            </div>
          </>
        )}
      </div>

      {modal && (
        <div
          onClick={closeModal}
          style={{ position: "fixed", inset: 0, background: "rgba(26,25,22,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 20 }}
        >
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 380, background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 28 }}>
            <h2 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 22, fontWeight: 600, color: "#1A1916", margin: "0 0 20px" }}>
              Change password
            </h2>

            {done ? (
              <>
                <div style={{ padding: "10px 12px", background: "#F0FAF4", border: "1px solid #BBEFCE", borderRadius: 6, color: "#166534", fontSize: 13, marginBottom: 20 }}>
                  ✓ Password updated.
                </div>
                <button onClick={closeModal} style={{ width: "100%", padding: "11px 0", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  Done
                </button>
              </>
            ) : (
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Current password</label>
                  <input name="current" type="password" required style={inputStyle} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>New password (8+ characters)</label>
                  <input name="next" type="password" required minLength={8} style={inputStyle} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle}>Confirm new password</label>
                  <input name="confirm" type="password" required minLength={8} style={inputStyle} />
                </div>
                {error && (
                  <div style={{ marginBottom: 16, padding: "10px 12px", background: "#FDF1EC", border: "1px solid #F5C4B4", borderRadius: 6, color: "#C2410C", fontSize: 13 }}>
                    {error}
                  </div>
                )}
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" onClick={closeModal} style={{ flex: 1, padding: "11px 0", background: "#fff", color: "#6B6760", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={loading} style={{ flex: 1, padding: "11px 0", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1 }}>
                    {loading ? "Saving…" : "Update"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
