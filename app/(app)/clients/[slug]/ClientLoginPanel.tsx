"use client"
import { useEffect, useState } from "react"

interface Status {
  clientEmail: string
  user: { email: string; hasPassword: boolean } | null
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
            {hasLogin ? (
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

          <button onClick={generate} disabled={generating} style={{ ...btnStyle, opacity: generating ? 0.7 : 1, cursor: generating ? "default" : "pointer" }}>
            {generating
              ? "Generating…"
              : hasLogin
                ? "Generate new link (password reset)"
                : invited
                  ? "Generate a fresh link"
                  : "Generate invite link"}
          </button>
        </>
      )}
    </div>
  )
}
