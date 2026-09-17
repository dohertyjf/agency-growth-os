"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

interface Status {
  clientEmail: string
  user: { email: string; hasPassword: boolean; active: boolean } | null
  invitePending: boolean
}

const cardStyle: React.CSSProperties = {
  background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 24, marginTop: 24,
}
const btnStyle: React.CSSProperties = {
  padding: "10px 16px", background: "#E9532A", color: "#fff", border: "none",
  borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
}
const inputStyle: React.CSSProperties = {
  padding: "8px 12px", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 13,
  background: "#FBFAF7", color: "#1A1916", width: "100%", boxSizing: "border-box",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
}

export default function ClientLoginPanel({ clientId, clientName }: { clientId: string; clientName: string }) {
  const firstName = clientName.trim().split(/\s+/)[0] || "your client"
  const router = useRouter()
  const [switching, setSwitching] = useState(false)
  const [status, setStatus] = useState<Status | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function loadStatus() {
    setLoading(true)
    try {
      const res = await fetch(`/api/clients/${clientId}/invite`)
      if (res.ok) setStatus(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  async function generate() {
    setGenerating(true)
    setError(null)
    setLink(null)
    setCopied(false)
    try {
      const res = await fetch(`/api/clients/${clientId}/invite`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Could not generate an invite link")
        return
      }
      setLink(data.link)
      await loadStatus()
    } finally {
      setGenerating(false)
    }
  }

  async function setActive(active: boolean) {
    if (active === false && !confirm(`Deactivate ${firstName}'s login? They won't be able to sign in, but their profile and data are kept. You can reactivate anytime.`)) return
    const res = await fetch(`/api/clients/${clientId}/invite`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    })
    if (res.ok) await loadStatus()
  }

  // Switch user: use the app as this client, with a "switch back" bar up top.
  async function useAs() {
    setSwitching(true)
    setError(null)
    const res = await fetch("/api/auth/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
    })
    if (res.ok) {
      router.push("/dashboard")
      router.refresh()
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error || "Could not switch user")
      setSwitching(false)
    }
  }

  async function copy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked — the link is selectable in the field as a fallback.
    }
  }

  const deactivated = status?.user?.active === false
  const hasLogin = status?.user?.hasPassword
  const invited = status?.user && !status.user.hasPassword

  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#9C9590", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6 }}>
        Client login
      </div>
      <p style={{ fontSize: 13, color: "#6B6760", margin: "0 0 16px", lineHeight: 1.5 }}>
        Give {firstName} their own login to see their dashboard, calls, and data. Generate a link
        below, then send it to {firstName} and ask them to set their password. Nothing is emailed
        automatically. Use the same button any time to send a password-reset link. Links expire in 7 days.
      </p>

      {loading ? (
        <div style={{ fontSize: 13, color: "#9C9590" }}>Loading…</div>
      ) : (
        <>
          <div style={{ fontSize: 13, marginBottom: 16 }}>
            {deactivated ? (
              <span style={{ color: "#B91C1C", fontWeight: 600 }}>
                ⊘ {firstName}&apos;s login is deactivated ({status?.user?.email}) — they can&apos;t sign in. Profile and data are kept.
              </span>
            ) : hasLogin ? (
              <span style={{ color: "#166534", fontWeight: 600 }}>
                ✓ {firstName} has an active login ({status?.user?.email}).
              </span>
            ) : invited ? (
              <span style={{ color: "#854D0E", fontWeight: 600 }}>
                A link was generated for {status?.user?.email}, but {firstName} hasn&apos;t set a password yet. Send them a link below.
              </span>
            ) : (
              <span style={{ color: "#6B6760" }}>
                No login yet. The link will be for <strong>{status?.clientEmail}</strong>.
              </span>
            )}
          </div>

          {error && (
            <div style={{ marginBottom: 16, padding: "10px 12px", background: "#FDF1EC", border: "1px solid #F5C4B4", borderRadius: 6, color: "#C2410C", fontSize: 13 }}>
              {error}
            </div>
          )}

          {link && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#166534", marginBottom: 8 }}>
                Send this link to {firstName} and ask them to set their password:
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input readOnly value={link} onFocus={e => e.currentTarget.select()} style={inputStyle} />
                <button onClick={copy} style={{ ...btnStyle, whiteSpace: "nowrap", background: copied ? "#166534" : "#1A1916" }}>
                  {copied ? "Copied ✓" : "Copy"}
                </button>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {deactivated ? (
              <button onClick={() => setActive(true)} style={btnStyle}>Reactivate login</button>
            ) : (
              <button onClick={generate} disabled={generating} style={{ ...btnStyle, opacity: generating ? 0.7 : 1, cursor: generating ? "default" : "pointer" }}>
                {generating
                  ? "Generating…"
                  : hasLogin
                    ? "Generate new link (password reset)"
                    : invited
                      ? "Generate a fresh link"
                      : "Generate invite link"}
              </button>
            )}
            {status?.user && (
              <button onClick={useAs} disabled={switching} style={{ padding: "10px 16px", background: "#fff", color: "#1A1916", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: switching ? "default" : "pointer", fontFamily: "inherit", opacity: switching ? 0.7 : 1 }}>
                {switching ? "Switching…" : `Use August as ${firstName}`}
              </button>
            )}
            {status?.user && !deactivated && (
              <button onClick={() => setActive(false)} style={{ padding: "10px 16px", background: "#fff", color: "#B91C1C", border: "1px solid #F5C4B4", borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Deactivate login
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
