"use client"
import { signIn } from "next-auth/react"
import { useState } from "react"
import { useRouter } from "next/navigation"

export default function SignInPage() {
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const fd = new FormData(e.currentTarget)
    const res = await signIn("credentials", {
      email: fd.get("email") as string,
      password: fd.get("password") as string,
      redirect: false,
    })
    setLoading(false)
    if (res?.error) {
      setError("Invalid email or password")
    } else {
      router.push("/dashboard")
      router.refresh()
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#FBFAF7", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 400, padding: "0 24px" }}>
        <div style={{ marginBottom: 36, textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, background: "#E9532A", borderRadius: 10, color: "#fff", fontWeight: 800, fontSize: 16, marginBottom: 16 }}>
            JD
          </div>
          <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 28, fontWeight: 600, color: "#1A1916", margin: "0 0 6px" }}>
            Agency Growth OS
          </h1>
          <p style={{ color: "#6B6760", fontSize: 14, margin: 0 }}>Sign in to your account</p>
        </div>

        <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 28 }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "#1A1916" }}>
                Email
              </label>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 14, background: "#FBFAF7", color: "#1A1916", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "#1A1916" }}>
                Password
              </label>
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 14, background: "#FBFAF7", color: "#1A1916", boxSizing: "border-box" }}
              />
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
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
