"use client"
import { useState } from "react"
import Link from "next/link"
import { CATEGORIES } from "@/lib/library"

export interface EditorTraining {
  id?: string
  title: string
  category: string
  date: string
  summary: string
  outline: string
  takeaways: string
  actionSteps: string
  video: string
  worksheet: string
  transcript: string
  sourceCallId: string | null
  published: boolean
  tags: string[]
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 12px", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 14,
  background: "#fff", color: "#1A1916", boxSizing: "border-box", fontFamily: "inherit",
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#9C9590", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
        {label}{hint && <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0, marginLeft: 6 }}>{hint}</span>}
      </label>
      {children}
    </div>
  )
}

export default function TrainingEditor({ initial, allTags, sourceCallTitle, synopsis }: {
  initial: EditorTraining
  allTags: string[]
  sourceCallTitle?: string
  synopsis?: string // the source call's recap — extra context for the Claude draft
}) {
  const [t, setT] = useState<EditorTraining>(initial)
  const [tagInput, setTagInput] = useState("")
  const [saving, setSaving] = useState(false)
  const [drafting, setDrafting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showTranscript, setShowTranscript] = useState(false)

  const set = (patch: Partial<EditorTraining>) => setT(prev => ({ ...prev, ...patch }))

  function addTag(raw: string) {
    const names = raw.split(",").map(s => s.trim().toLowerCase().replace(/^#/, "")).filter(Boolean)
    if (names.length) set({ tags: [...new Set([...t.tags, ...names])] })
    setTagInput("")
  }

  async function draft() {
    setDrafting(true); setError(null)
    const res = await fetch("/api/library/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: sourceCallTitle ?? t.title, transcript: t.transcript, synopsis }),
    })
    const data = await res.json().catch(() => ({}))
    setDrafting(false)
    if (!res.ok) { setError(data.error ?? "Couldn't draft this one."); return }
    set({
      title: data.title || t.title,
      category: t.category || data.category || "",
      summary: data.summary || t.summary,
      outline: data.outline?.length ? data.outline.join("\n") : t.outline,
      takeaways: data.takeaways?.length ? data.takeaways.join("\n") : t.takeaways,
      actionSteps: data.actionSteps?.length ? data.actionSteps.join("\n") : t.actionSteps,
      tags: [...new Set([...t.tags, ...(data.tags ?? []).map((s: string) => s.toLowerCase())])],
    })
  }

  async function save(published: boolean) {
    if (!t.title.trim() || !t.category) { setError("Give it a title and a category."); return }
    setSaving(true); setError(null)
    const body = {
      title: t.title, category: t.category, date: t.date || null,
      summary: t.summary, outline: t.outline, takeaways: t.takeaways, actionSteps: t.actionSteps,
      video: t.video.trim() || null, worksheet: t.worksheet.trim() || null, transcript: t.transcript || null,
      sourceCallId: t.sourceCallId, published, tags: t.tags,
    }
    const res = await fetch(t.id ? `/api/library/trainings/${t.id}` : "/api/library/trainings", {
      method: t.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) { setError(data.error ?? "Couldn't save."); return }
    window.location.assign(`/sessions/${data.id}`)
  }

  async function remove() {
    if (!t.id || !confirm(`Delete "${t.title}" from Sessions? The original call is kept.`)) return
    const res = await fetch(`/api/library/trainings/${t.id}`, { method: "DELETE" })
    if (res.ok) window.location.assign("/sessions")
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <Link href={t.id ? `/sessions/${t.id}` : "/sessions"} style={{ fontSize: 13, color: "#9C9590", textDecoration: "none" }}>← {t.id ? "Back to training" : "Sessions"}</Link>
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "8px 0 4px", flexWrap: "wrap" }}>
        <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 28, fontWeight: 600, margin: 0, color: "#1A1916", flex: 1 }}>
          {t.id ? "Edit training" : "New training"}
        </h1>
        <button onClick={draft} disabled={drafting || (!t.transcript.trim() && !synopsis?.trim())}
          title={!t.transcript.trim() && !synopsis?.trim() ? "Paste a transcript first" : "Fill in the title, summary, outline, takeaways, steps and tags from the transcript"}
          style={{ padding: "7px 14px", background: "#fff", border: "1px solid #E9532A", color: "#E9532A", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: drafting || (!t.transcript.trim() && !synopsis?.trim()) ? 0.5 : 1 }}>
          {drafting ? "Drafting… (~30s)" : "✦ Draft with Claude"}
        </button>
      </div>
      <p style={{ fontSize: 13, color: "#9C9590", margin: "0 0 24px" }}>
        {sourceCallTitle ? <>From the call <strong>{sourceCallTitle}</strong>. The original call isn&apos;t changed.</> : "A training clients can find in Sessions."}
      </p>

      <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 24 }}>
        <Field label="Title">
          <input value={t.title} onChange={e => set({ title: e.target.value })} placeholder="How to price a retainer" style={inputStyle} />
        </Field>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 2, minWidth: 220 }}>
            <Field label="Category">
              <select value={t.category} onChange={e => set({ category: e.target.value })} style={inputStyle}>
                <option value="">Choose…</option>
                {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label} — {c.blurb}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ flex: 1, minWidth: 150 }}>
            <Field label="Recorded">
              <input type="date" value={t.date} onChange={e => set({ date: e.target.value })} style={inputStyle} />
            </Field>
          </div>
        </div>

        <Field label="Tags" hint="Enter or comma to add">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", padding: "6px 8px", border: "1px solid #ECE7DE", borderRadius: 6 }}>
            {t.tags.map(tag => (
              <span key={tag} style={{ fontSize: 12, padding: "3px 8px", background: "#F5F1EC", borderRadius: 10, color: "#4A4640", display: "flex", gap: 4, alignItems: "center" }}>
                #{tag}
                <button type="button" onClick={() => set({ tags: t.tags.filter(x => x !== tag) })} style={{ background: "none", border: "none", cursor: "pointer", color: "#9C9590", padding: 0, fontSize: 14, lineHeight: 1 }}>×</button>
              </span>
            ))}
            <input
              value={tagInput}
              list="library-tags"
              onChange={e => { if (e.target.value.endsWith(",")) addTag(e.target.value); else setTagInput(e.target.value) }}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(tagInput) } }}
              onBlur={() => tagInput && addTag(tagInput)}
              placeholder={t.tags.length ? "" : "growth, sales…"}
              style={{ border: "none", outline: "none", fontSize: 13, flex: 1, minWidth: 100, padding: "3px 2px" }}
            />
            <datalist id="library-tags">{allTags.filter(x => !t.tags.includes(x)).map(x => <option key={x} value={x} />)}</datalist>
          </div>
        </Field>

        <Field label="Recording" hint="YouTube, Loom or Vimeo link">
          <input value={t.video} onChange={e => set({ video: e.target.value })} placeholder="https://…" style={inputStyle} />
        </Field>

        <Field label="Worksheet" hint="Link to the Google Doc, PDF, etc.">
          <input value={t.worksheet} onChange={e => set({ worksheet: e.target.value })} placeholder="https://…" style={inputStyle} />
        </Field>

        <Field label="Summary" hint="What they'll learn">
          <textarea value={t.summary} onChange={e => set({ summary: e.target.value })} rows={3} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
        </Field>

        <Field label="What we covered" hint="Short topic list in session order, one per line — optional 0:25 timestamp">
          <textarea value={t.outline} onChange={e => set({ outline: e.target.value })} rows={6} placeholder={"0:20 · Pick one ICP — the magnifying glass\n0:30 · Audit the leads you already have"} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
        </Field>

        <Field label="Key takeaways" hint="One per line">
          <textarea value={t.takeaways} onChange={e => set({ takeaways: e.target.value })} rows={5} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
        </Field>

        <Field label="Implement this" hint="One step per line — clients tick these off">
          <textarea value={t.actionSteps} onChange={e => set({ actionSteps: e.target.value })} rows={5} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
        </Field>

        <Field label="Transcript" hint={t.transcript ? `${Math.round(t.transcript.length / 1000)}k characters · searchable by clients` : "Searchable by clients"}>
          {showTranscript || !t.transcript ? (
            <textarea value={t.transcript} onChange={e => set({ transcript: e.target.value })} rows={showTranscript ? 14 : 4} placeholder="Paste the transcript…" style={{ ...inputStyle, resize: "vertical", fontSize: 12, lineHeight: 1.5 }} />
          ) : (
            <button type="button" onClick={() => setShowTranscript(true)} style={{ fontSize: 12, color: "#6B6760", background: "none", border: "1px solid #ECE7DE", borderRadius: 5, padding: "5px 10px", cursor: "pointer" }}>Show transcript</button>
          )}
        </Field>

        {error && <div style={{ fontSize: 13, color: "#B91C1C", marginBottom: 14 }}>{error}</div>}

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", paddingTop: 6 }}>
          <button onClick={() => save(true)} disabled={saving} style={{ padding: "9px 20px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
            {t.published ? "Save" : "Publish"}
          </button>
          <button onClick={() => save(false)} disabled={saving} style={{ padding: "9px 16px", background: "none", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 14, color: "#4A4640", cursor: "pointer" }}>
            {t.published ? "Unpublish" : "Save as draft"}
          </button>
          {t.id && (
            <button onClick={remove} style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, color: "#B91C1C", background: "none", border: "1px solid #F3D4D4", borderRadius: 5, padding: "6px 12px", cursor: "pointer" }}>Delete</button>
          )}
        </div>
      </div>
    </div>
  )
}
