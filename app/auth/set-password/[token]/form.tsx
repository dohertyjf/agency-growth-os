"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

export default function SetPasswordForm({ token }: { token: string }) {
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const password = fd.get("password") as string
    const confirm = fd.get("confirm") as string
    if (password !== confirm) { setError("Passwords do not match"); return }
    setLoading(true)
    setError("")
    const res = await fetch("/api/auth/set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error || "Something went wrong"); return }
    setDone(true)
    setTimeout(() => router.push("/auth/signin"), 2000)
  }

  if (done) {
    return (
      <div style={{ minHeight: "100vh", background: "#FBFAF7", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#1F7A4D", marginBottom: 8 }}>Password set!</div>
          <p style={{ color: "#6B6760", fontSize: 14 }}>Redirecting to sign in…</p>
        </div>
      </div>
    )
  }

  const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 12px", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 14, background: "#FBFAF7", color: "#1A1916", boxSizing: "border-box" }
  const labelStyle: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "#1A1916" }

  return (
    <div style={{ minHeight: "100vh", background: "#FBFAF7", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 400, padding: "0 24px" }}>
        <div style={{ marginBottom: 32, textAlign: "center" }}>
          <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 28, fontWeight: 600, color: "#1A1916", margin: "0 0 6px" }}>
            Set your password
          </h1>
          <p style={{ color: "#6B6760", fontSize: 14, margin: 0 }}>Choose a password to access your account.</p>
        </div>
        <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 28 }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Password (8+ characters)</label>
              <input name="password" type="password" required minLength={8} style={inputStyle} />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Confirm password</label>
              <input name="confirm" type="password" required minLength={8} style={inputStyle} />
            </div>
            {error && (
              <div style={{ marginBottom: 16, padding: "10px 12px", background: "#FDF1EC", border: "1px solid #F5C4B4", borderRadius: 6, color: "#C2410C", fontSize: 13 }}>
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              style={{ width: "100%", padding: "11px 0", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1 }}
            >
              {loading ? "Setting password…" : "Set password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
