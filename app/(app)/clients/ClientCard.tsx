"use client"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { fmtCurrency } from "@/lib/calc"
import { useState } from "react"

interface Props {
  id: string
  slug: string | null
  name: string
  agency: string | null
  status: string
  mrr: number
  latestRevenue: number | null
}

const STATUSES = ["active", "potential", "paused"] as const
const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  active: { bg: "#DCFCE7", text: "#166534" },
  potential: { bg: "#DBEAFE", text: "#1E40AF" },
  paused: { bg: "#FEF9C3", text: "#854D0E" },
}

export default function ClientCard({ id, slug, name, agency, status: initialStatus, mrr, latestRevenue }: Props) {
  const router = useRouter()
  const [hovered, setHovered] = useState(false)
  const [status, setStatus] = useState(initialStatus)
  const [menuOpen, setMenuOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const href = slug ? `/clients/${slug}/dashboard` : `/clients/${id}/dashboard`
  const st = STATUS_STYLE[status] ?? STATUS_STYLE.paused

  function stop(e: React.MouseEvent) { e.preventDefault(); e.stopPropagation() }

  async function change(e: React.MouseEvent, next: string) {
    stop(e)
    setMenuOpen(false)
    if (next === status) return
    const prev = status
    setStatus(next); setSaving(true)
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) { setStatus(prev); return }
      router.refresh()
    } catch { setStatus(prev) } finally { setSaving(false) }
  }

  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          background: "#fff",
          border: `1px solid ${hovered ? "#E9532A" : "#ECE7DE"}`,
          borderRadius: 12,
          padding: 20,
          cursor: "pointer",
          boxShadow: hovered ? "0 2px 8px rgba(233,83,42,0.1)" : "none",
          transition: "border-color 0.12s, box-shadow 0.12s",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1A1916", marginBottom: 2 }}>{name}</div>
            {agency && <div style={{ fontSize: 12, color: "#9C9590" }}>{agency}</div>}
          </div>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <button
              onClick={e => { stop(e); setMenuOpen(o => !o) }}
              title="Change status"
              style={{
                fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, border: "none",
                background: st.bg, color: st.text, textTransform: "uppercase", letterSpacing: "0.04em",
                cursor: "pointer", opacity: saving ? 0.6 : 1, display: "flex", alignItems: "center", gap: 4,
              }}
            >
              {status}
              <span style={{ fontSize: 8 }}>▾</span>
            </button>
            {menuOpen && (
              <>
                <div onClick={e => { stop(e); setMenuOpen(false) }} style={{ position: "fixed", inset: 0, zIndex: 10 }} />
                <div onClick={stop} style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 11, background: "#fff", border: "1px solid #ECE7DE", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", padding: 4, minWidth: 120 }}>
                  {STATUSES.map(s => {
                    const ss = STATUS_STYLE[s]
                    return (
                      <button key={s} onClick={e => change(e, s)}
                        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", background: "none", border: "none", borderRadius: 6, padding: "7px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#1A1916" }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: ss.text, flexShrink: 0 }} />
                        <span style={{ textTransform: "capitalize", flex: 1 }}>{s}</span>
                        {s === status && <span style={{ color: "#E9532A" }}>✓</span>}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 20 }}>
          <div>
            <div style={{ fontSize: 10, color: "#9C9590", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>MRR</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1A1916", fontVariantNumeric: "tabular-nums" }}>{fmtCurrency(mrr)}</div>
          </div>
          {latestRevenue !== null && (
            <div>
              <div style={{ fontSize: 10, color: "#9C9590", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>Revenue</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#1A1916", fontVariantNumeric: "tabular-nums" }}>{fmtCurrency(latestRevenue)}</div>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
