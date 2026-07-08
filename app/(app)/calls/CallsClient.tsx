"use client"
import { useState } from "react"

interface Question { id: string; q: string; a: string | null; order: number }
interface Call {
  id: string
  clientId: string
  date: string
  title: string
  transcript: string | null
  video: string | null
  synopsis: string | null
  notes: string | null
  questions: Question[]
}
interface Client { id: string; name: string }

interface Props {
  calls: Call[]
  clients: Client[]
  isCoach: boolean
  defaultClientId?: string
}

export default function CallsClient({ calls: initialCalls, clients, isCoach, defaultClientId }: Props) {
  const [calls, setCalls] = useState<Call[]>(initialCalls)
  const [selected, setSelected] = useState<Call | null>(calls[0] ?? null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ clientId: defaultClientId ?? clients[0]?.id ?? "", date: new Date().toISOString().slice(0, 10), title: "" })
  const [saving, setSaving] = useState(false)
  const [editingNote, setEditingNote] = useState<{ callId: string; field: "synopsis" | "notes"; value: string } | null>(null)
  const [addingQ, setAddingQ] = useState(false)
  const [qForm, setQForm] = useState({ q: "" })

  async function handleAddCall(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch(`/api/clients/${form.clientId}/calls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: form.date, title: form.title, questions: [] }),
    })
    const data = await res.json()
    if (res.ok && data.call) {
      const newCall = { ...data.call, questions: [] }
      setCalls(prev => [newCall, ...prev])
      setSelected(newCall)
      setAdding(false)
      setForm(f => ({ ...f, title: "" }))
    }
    setSaving(false)
  }

  async function saveField(callId: string, field: "synopsis" | "notes", value: string) {
    await fetch(`/api/calls/${callId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    })
    setCalls(prev => prev.map(c => c.id === callId ? { ...c, [field]: value } : c))
    if (selected?.id === callId) setSelected(s => s ? { ...s, [field]: value } : s)
  }

  async function handleAddQuestion(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    const res = await fetch(`/api/calls/${selected.id}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: qForm.q }),
    })
    const data = await res.json()
    if (res.ok && data.question) {
      const updatedCall = { ...selected, questions: [...selected.questions, data.question] }
      setCalls(prev => prev.map(c => c.id === selected.id ? updatedCall : c))
      setSelected(updatedCall)
      setQForm({ q: "" })
      setAddingQ(false)
    }
  }

  async function handleAnswerBlur(questionId: string, answer: string) {
    await fetch(`/api/questions/${questionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ a: answer }),
    })
    if (selected) {
      const updatedCall = { ...selected, questions: selected.questions.map(q => q.id === questionId ? { ...q, a: answer } : q) }
      setCalls(prev => prev.map(c => c.id === selected.id ? updatedCall : c))
      setSelected(updatedCall)
    }
  }

  const sideStyle: React.CSSProperties = {
    width: 280,
    flexShrink: 0,
    background: "#fff",
    border: "1px solid #ECE7DE",
    borderRadius: 12,
    overflow: "hidden",
    alignSelf: "flex-start",
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 28, fontWeight: 600, color: "#1A1916", margin: 0 }}>Calls</h1>
        {isCoach && (
          <button onClick={() => setAdding(a => !a)} style={{ padding: "7px 16px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            + New Call
          </button>
        )}
      </div>

      {/* Add call form */}
      {adding && isCoach && (
        <form onSubmit={handleAddCall} style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 10, padding: 16, marginBottom: 16, display: "flex", gap: 10, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, color: "#9C9590", display: "block", marginBottom: 4 }}>Title</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required placeholder="Monthly strategy call" style={{ width: "100%", padding: "7px 10px", border: "1px solid #ECE7DE", borderRadius: 5, fontSize: 13, boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#9C9590", display: "block", marginBottom: 4 }}>Date</label>
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required style={{ padding: "7px 10px", border: "1px solid #ECE7DE", borderRadius: 5, fontSize: 13 }} />
          </div>
          {clients.length > 1 && (
            <div>
              <label style={{ fontSize: 11, color: "#9C9590", display: "block", marginBottom: 4 }}>Client</label>
              <select value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))} style={{ padding: "7px 10px", border: "1px solid #ECE7DE", borderRadius: 5, fontSize: 13 }}>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <button type="submit" disabled={saving} style={{ padding: "7px 16px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Save</button>
        </form>
      )}

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        {/* Call list */}
        <div style={sideStyle}>
          {calls.length === 0 ? (
            <div style={{ padding: 20, color: "#9C9590", fontSize: 13 }}>No calls yet.</div>
          ) : (
            calls.map(call => (
              <div
                key={call.id}
                onClick={() => setSelected(call)}
                style={{
                  padding: "12px 16px",
                  cursor: "pointer",
                  background: selected?.id === call.id ? "#FFF7F4" : "transparent",
                  borderLeft: `3px solid ${selected?.id === call.id ? "#E9532A" : "transparent"}`,
                  borderBottom: "1px solid #F5F1EC",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1916" }}>{call.title}</div>
                <div style={{ fontSize: 11, color: "#9C9590", marginTop: 2 }}>{call.date}</div>
              </div>
            ))
          )}
        </div>

        {/* Call detail */}
        {selected && (
          <div style={{ flex: 1, background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 24 }}>
            <h2 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 22, fontWeight: 600, margin: "0 0 4px" }}>{selected.title}</h2>
            <div style={{ fontSize: 12, color: "#9C9590", marginBottom: 20 }}>{selected.date}</div>

            {/* Synopsis */}
            <Section label="Synopsis">
              {editingNote?.callId === selected.id && editingNote.field === "synopsis" ? (
                <div>
                  <textarea
                    autoFocus
                    defaultValue={editingNote.value}
                    rows={4}
                    style={{ width: "100%", border: "1px solid #ECE7DE", borderRadius: 6, padding: 10, fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
                    onBlur={e => { saveField(selected.id, "synopsis", e.target.value); setEditingNote(null) }}
                  />
                </div>
              ) : (
                <div
                  onClick={() => isCoach && setEditingNote({ callId: selected.id, field: "synopsis", value: selected.synopsis ?? "" })}
                  style={{ fontSize: 13, color: selected.synopsis ? "#1A1916" : "#C0BAB2", cursor: isCoach ? "text" : "default", minHeight: 32, lineHeight: 1.6 }}
                >
                  {selected.synopsis || (isCoach ? "Click to add synopsis…" : "—")}
                </div>
              )}
            </Section>

            {/* Notes */}
            <Section label="Coach Notes">
              {editingNote?.callId === selected.id && editingNote.field === "notes" ? (
                <textarea
                  autoFocus
                  defaultValue={editingNote.value}
                  rows={4}
                  style={{ width: "100%", border: "1px solid #ECE7DE", borderRadius: 6, padding: 10, fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
                  onBlur={e => { saveField(selected.id, "notes", e.target.value); setEditingNote(null) }}
                />
              ) : (
                <div
                  onClick={() => isCoach && setEditingNote({ callId: selected.id, field: "notes", value: selected.notes ?? "" })}
                  style={{ fontSize: 13, color: selected.notes ? "#1A1916" : "#C0BAB2", cursor: isCoach ? "text" : "default", minHeight: 32, lineHeight: 1.6 }}
                >
                  {selected.notes || (isCoach ? "Click to add notes…" : "—")}
                </div>
              )}
            </Section>

            {/* Q&A */}
            <Section label="Questions & Actions">
              {selected.questions.map(q => (
                <div key={q.id} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1916", marginBottom: 4 }}>{q.q}</div>
                  <textarea
                    defaultValue={q.a ?? ""}
                    placeholder="Answer / action…"
                    rows={2}
                    disabled={!isCoach}
                    style={{ width: "100%", border: "1px solid #ECE7DE", borderRadius: 5, padding: "7px 10px", fontSize: 13, resize: "vertical", boxSizing: "border-box", background: isCoach ? "#FBFAF7" : "#F8F6F2", color: "#1A1916" }}
                    onBlur={e => isCoach && handleAnswerBlur(q.id, e.target.value)}
                  />
                </div>
              ))}

              {isCoach && (
                addingQ ? (
                  <form onSubmit={handleAddQuestion} style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <input
                      autoFocus
                      value={qForm.q}
                      onChange={e => setQForm({ q: e.target.value })}
                      required
                      placeholder="Question or action item…"
                      style={{ flex: 1, padding: "7px 10px", border: "1px solid #ECE7DE", borderRadius: 5, fontSize: 13 }}
                    />
                    <button type="submit" style={{ padding: "7px 14px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 5, fontSize: 13, cursor: "pointer" }}>Add</button>
                    <button type="button" onClick={() => setAddingQ(false)} style={{ padding: "7px 10px", background: "none", border: "1px solid #ECE7DE", borderRadius: 5, fontSize: 13, cursor: "pointer" }}>Cancel</button>
                  </form>
                ) : (
                  <button onClick={() => setAddingQ(true)} style={{ fontSize: 12, color: "#9C9590", background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: 8 }}>
                    + Add question
                  </button>
                )
              )}
            </Section>

            {/* Video link */}
            {(selected.video || isCoach) && (
              <Section label="Recording">
                {selected.video
                  ? <a href={selected.video} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "#E9532A" }}>Open recording ↗</a>
                  : <span style={{ fontSize: 13, color: "#C0BAB2" }}>No recording linked.</span>
                }
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 10, color: "#9C9590", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
        {label}
      </div>
      {children}
    </div>
  )
}
