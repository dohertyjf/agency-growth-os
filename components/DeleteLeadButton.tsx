"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

// Two-step delete: "Delete" -> "Confirm / Cancel". Refreshes the list, or
// redirects (when used from a detail page) on success.
export default function DeleteLeadButton({ endpoint, redirectTo }: { endpoint: string; redirectTo?: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function del(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDeleting(true)
    try {
      const res = await fetch(endpoint, { method: "DELETE" })
      if (res.ok) {
        if (redirectTo) router.push(redirectTo)
        else router.refresh()
      }
    } finally {
      setDeleting(false)
    }
  }

  function ask(e: React.MouseEvent) { e.preventDefault(); e.stopPropagation(); setConfirming(true) }
  function cancel(e: React.MouseEvent) { e.preventDefault(); e.stopPropagation(); setConfirming(false) }

  const btn: React.CSSProperties = { fontSize: 12, fontWeight: 600, borderRadius: 6, padding: "6px 10px", cursor: "pointer", border: "1px solid #ECE7DE", background: "#fff" }

  if (confirming) {
    return (
      <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
        <button onClick={del} disabled={deleting} style={{ ...btn, border: "none", background: "#C2410C", color: "#fff", opacity: deleting ? 0.6 : 1 }}>
          {deleting ? "Deleting…" : "Confirm"}
        </button>
        <button onClick={cancel} style={{ ...btn, color: "#6B6760" }}>Cancel</button>
      </span>
    )
  }
  return (
    <button onClick={ask} title="Delete" style={{ ...btn, color: "#9C9590" }}>Delete</button>
  )
}
