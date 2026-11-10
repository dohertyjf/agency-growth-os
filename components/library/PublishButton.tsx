"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

// Coach-only toggle on a session page: publish a draft so clients with
// Sessions access can see it, or pull it back to a draft.
export default function PublishButton({ trainingId, published }: { trainingId: string; published: boolean }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  async function toggle() {
    if (published && !confirm("Unpublish this session? Clients won't see it until you publish it again.")) return
    setSaving(true); setError(false)
    const res = await fetch(`/api/library/trainings/${trainingId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ published: !published }),
    })
    setSaving(false)
    if (!res.ok) { setError(true); return }
    router.refresh()
  }

  return (
    <button onClick={toggle} disabled={saving} title={error ? "Couldn't save — try again" : undefined}
      style={published
        ? { padding: "6px 14px", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 13, color: error ? "#B23A1B" : "#4A4640", background: "#fff", cursor: "pointer", opacity: saving ? 0.6 : 1 }
        : { padding: "6px 16px", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, color: "#fff", background: error ? "#B23A1B" : "#E9532A", cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
      {saving ? "Saving…" : error ? "Try again" : published ? "Unpublish" : "Publish"}
    </button>
  )
}
