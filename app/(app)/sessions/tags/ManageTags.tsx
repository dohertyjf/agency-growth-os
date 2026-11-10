"use client"
import { useState } from "react"
import Link from "next/link"

interface Tag { id: string; name: string; count: number }

export default function ManageTags({ initialTags }: { initialTags: Tag[] }) {
  const [tags, setTags] = useState(initialTags)

  async function rename(t: Tag) {
    const name = prompt(`Rename #${t.name} to (an existing tag name merges them):`, t.name)?.trim().toLowerCase()
    if (!name || name === t.name) return
    const res = await fetch(`/api/library/tags/${t.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) })
    if (!res.ok) return
    const data = await res.json()
    setTags(prev => {
      if (!data.mergedFrom) return prev.map(x => x.id === t.id ? { ...x, name: data.name } : x).sort((a, b) => a.name.localeCompare(b.name))
      // Approximate merged count; exact on reload.
      return prev.filter(x => x.id !== t.id).map(x => x.id === data.id ? { ...x, count: x.count + t.count } : x)
    })
  }

  async function remove(t: Tag) {
    if (!confirm(`Delete #${t.name}? It comes off ${t.count} training${t.count === 1 ? "" : "s"}.`)) return
    const res = await fetch(`/api/library/tags/${t.id}`, { method: "DELETE" })
    if (res.ok) setTags(prev => prev.filter(x => x.id !== t.id))
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <Link href="/sessions" style={{ fontSize: 13, color: "#9C9590", textDecoration: "none" }}>← Sessions</Link>
      <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 28, fontWeight: 600, margin: "8px 0 4px", color: "#1A1916" }}>Tags</h1>
      <p style={{ fontSize: 13, color: "#9C9590", margin: "0 0 24px" }}>Tags are created as you add them to trainings. Click one to rename it; renaming onto an existing tag merges the two.</p>
      {tags.length === 0 ? (
        <div style={{ fontSize: 13, color: "#9C9590" }}>No tags yet.</div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {tags.map(t => (
            <span key={t.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, padding: "5px 10px", background: "#fff", border: "1px solid #ECE7DE", borderRadius: 14 }}>
              <button onClick={() => rename(t)} title="Rename" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 13, color: "#1A1916" }}>#{t.name}</button>
              <span style={{ color: "#9C9590", fontSize: 12 }}>{t.count}</span>
              <button onClick={() => remove(t)} title="Delete" style={{ background: "none", border: "none", color: "#9C9590", cursor: "pointer", fontSize: 15, padding: 0, lineHeight: 1 }}>×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
