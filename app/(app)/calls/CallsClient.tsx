"use client"
import { useEffect, useState } from "react"

interface Question { id: string; q: string; a: string | null; order: number }
interface Call {
  id: string
  clientId: string | null // null = draft from the recap webhook, waiting for a client
  date: string
  title: string
  transcript: string | null
  video: string | null
  synopsis: string | null
  notes: string | null
  isGroupCall: boolean
  programId: string | null
  isSalesCall: boolean // prospect call → Sales Calls tab; never has a client
  prospectEmail: string | null
  questions: Question[]
}
interface Client { id: string; name: string }
interface Program { id: string; name: string }

interface Props {
  calls: Call[]
  clients: Client[]
  programs?: Program[]
  isCoach: boolean
  defaultClientId?: string
  embedded?: boolean
  initialCallId?: string // open this call first (e.g. from a Slack link)
}

const PAGE_SIZE = 10

// Convert a share link into an embeddable player URL. Falls back to null (plain link).
function videoEmbedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`
  const loom = url.match(/loom\.com\/(?:share|embed)\/([\w-]+)/)
  if (loom) return `https://www.loom.com/embed/${loom[1]}`
  const vimeo = url.match(/vimeo\.com\/(\d+)/)
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`
  return null
}

function useIsMobile() {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px)")
    const update = () => setMobile(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])
  return mobile
}

function GroupBadge() {
  return (
    <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 8, background: "#EDE9FE", color: "#6D28D9", textTransform: "uppercase", letterSpacing: "0.04em", verticalAlign: "middle", whiteSpace: "nowrap" }}>
      Group
    </span>
  )
}

function DraftBadge() {
  return (
    <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 8, background: "#FEF3C7", color: "#92400E", textTransform: "uppercase", letterSpacing: "0.04em", verticalAlign: "middle", whiteSpace: "nowrap" }}>
      Draft
    </span>
  )
}

function SalesBadge() {
  return (
    <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 8, background: "#DCFCE7", color: "#166534", textTransform: "uppercase", letterSpacing: "0.04em", verticalAlign: "middle", whiteSpace: "nowrap" }}>
      Sales
    </span>
  )
}

export default function CallsClient({ calls: initialCalls, clients, programs = [], isCoach, defaultClientId, embedded, initialCallId }: Props) {
  const isMobile = useIsMobile()
  const byDateDesc = (a: Call, b: Call) => (b.date || "").localeCompare(a.date || "")
  // Coach's /calls page splits client recaps from sales calls; clients and the
  // embedded client-page view never see sales calls (they have no client).
  const showTabs = isCoach && !embedded
  // A deep link (?call=<id>, e.g. from a Slack alert) opens that call on its own tab.
  const linkedCall = initialCalls.find(c => c.id === initialCallId)
  const [tab, setTab] = useState<"client" | "sales">(showTabs && linkedCall?.isSalesCall ? "sales" : "client")
  const inTab = (c: Call, t = tab) => !showTabs || c.isSalesCall === (t === "sales")
  const [calls, setCalls] = useState<Call[]>([...initialCalls].sort(byDateDesc))
  const [selected, setSelected] = useState<Call | null>(linkedCall ?? [...initialCalls].sort(byDateDesc).find(c => inTab(c)) ?? null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ clientId: defaultClientId ?? clients[0]?.id ?? "", date: new Date().toISOString().slice(0, 10), title: "", isGroupCall: false, programId: "" })
  const [saving, setSaving] = useState(false)
  const [editingNote, setEditingNote] = useState<{ callId: string; field: "synopsis" | "notes"; value: string } | null>(null)
  const [addingQ, setAddingQ] = useState(false)
  const [qForm, setQForm] = useState({ q: "" })
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const sortedCalls = calls.filter(c => inTab(c)).sort(byDateDesc)
  const visibleCalls = sortedCalls.slice(0, visibleCount)
  const remaining = sortedCalls.length - visibleCount

  async function handleAddCall(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const sales = showTabs && tab === "sales"
    const res = await fetch(sales ? "/api/calls" : `/api/clients/${form.clientId}/calls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sales
        ? { date: form.date, title: form.title }
        : { date: form.date, title: form.title, isGroupCall: form.isGroupCall, programId: form.isGroupCall ? (form.programId || null) : null }),
    })
    const data = await res.json()
    if (res.ok && data.id) {
      const newCall: Call = { ...data, questions: data.questions ?? [] }
      setCalls(prev => [newCall, ...prev])
      setSelected(newCall)
      setAdding(false)
      setForm(f => ({ ...f, title: "", isGroupCall: false, programId: "" }))
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

  async function patchCall(callId: string, patch: Partial<Call>) {
    setCalls(prev => prev.map(c => c.id === callId ? { ...c, ...patch } : c))
    if (selected?.id === callId) setSelected(s => s ? { ...s, ...patch } : s)
    await fetch(`/api/calls/${callId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
  }

  function switchTab(t: "client" | "sales") {
    setTab(t)
    setVisibleCount(PAGE_SIZE)
    setAdding(false)
    setSelected([...calls].sort(byDateDesc).find(c => inTab(c, t)) ?? null)
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
    if (res.ok && data.id) {
      const updatedCall = { ...selected, questions: [...selected.questions, data] }
      setCalls(prev => prev.map(c => c.id === selected.id ? updatedCall : c))
      setSelected(updatedCall)
      setQForm({ q: "" })
      setAddingQ(false)
    }
  }

  async function handleDeleteQuestion(questionId: string) {
    if (!selected) return
    const updatedCall = { ...selected, questions: selected.questions.filter(q => q.id !== questionId) }
    setCalls(prev => prev.map(c => c.id === selected.id ? updatedCall : c))
    setSelected(updatedCall)
    await fetch(`/api/questions/${questionId}`, { method: "DELETE" })
  }

  async function handleDeleteCall(call: Call) {
    if (!confirm(`Delete "${call.title}"? Its recap, notes and questions go with it. This can't be undone.`)) return
    const res = await fetch(`/api/calls/${call.id}`, { method: "DELETE" })
    if (!res.ok) { alert("Couldn't delete that call."); return }
    const rest = calls.filter(c => c.id !== call.id)
    setCalls(rest)
    setSelected([...rest].sort(byDateDesc).find(c => inTab(c)) ?? null)
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

  // The call detail — rendered in the right pane on desktop, inline under the
  // tapped call on mobile. On mobile the title collapses the card.
  const detailCard = selected && (
    <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: isMobile ? 18 : 24, minWidth: 0 }}>
      <h2
        onClick={() => { if (isMobile) setSelected(null) }}
        style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 22, fontWeight: 600, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8, cursor: isMobile ? "pointer" : "default" }}
      >
        <span style={{ flex: 1 }}>{selected.title}</span>
        {selected.isGroupCall && <GroupBadge />}
        {selected.isSalesCall && <SalesBadge />}
        {!selected.isGroupCall && !selected.isSalesCall && !selected.clientId && <DraftBadge />}
        {isMobile && <span style={{ fontSize: 12, color: "#9C9590", fontFamily: "inherit" }}>▲</span>}
      </h2>
      <div style={{ fontSize: 12, color: "#9C9590", marginBottom: 20, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span>{selected.date}</span>
        {selected.isSalesCall && selected.prospectEmail && <span>{selected.prospectEmail}</span>}
        {isCoach && !embedded && !selected.isGroupCall && (
          <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={selected.isSalesCall}
              onChange={e => patchCall(selected.id, e.target.checked
                ? { isSalesCall: true, clientId: null, isGroupCall: false, programId: null }
                : { isSalesCall: false })}
              style={{ accentColor: "#E9532A" }}
            />
            Sales call
          </label>
        )}
        {isCoach && !embedded && !selected.isGroupCall && !selected.isSalesCall && clients.length > 0 && (
          <label style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span>Client:</span>
            <select
              value={selected.clientId ?? ""}
              onChange={e => { if (e.target.value) patchCall(selected.id, { clientId: e.target.value, isSalesCall: false }) }}
              style={{ padding: "3px 6px", border: `1px solid ${selected.clientId ? "#ECE7DE" : "#F59E0B"}`, borderRadius: 5, fontSize: 12 }}
            >
              {!selected.clientId && <option value="">Choose a client…</option>}
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        )}
        {isCoach && !selected.isSalesCall && (
          <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
            <input type="checkbox" checked={selected.isGroupCall} onChange={e => patchCall(selected.id, { isGroupCall: e.target.checked, ...(e.target.checked ? {} : { programId: null }) })} style={{ accentColor: "#E9532A" }} />
            Group call
          </label>
        )}
        {isCoach && selected.isGroupCall && (
          <label style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span>Program:</span>
            <select
              value={selected.programId ?? ""}
              onChange={e => patchCall(selected.id, { programId: e.target.value || null })}
              style={{ padding: "3px 6px", border: "1px solid #ECE7DE", borderRadius: 5, fontSize: 12 }}
            >
              <option value="">Unassigned — hidden</option>
              {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        )}
        {isCoach && (
          <button
            onClick={() => handleDeleteCall(selected)}
            style={{ marginLeft: "auto", fontSize: 11, fontWeight: 600, color: "#B91C1C", background: "none", border: "1px solid #F3D4D4", borderRadius: 5, padding: "3px 10px", cursor: "pointer" }}
          >
            Delete call
          </button>
        )}
      </div>

      {/* Recording */}
      <Section label="Recording">
        {(() => {
          const embed = selected.video ? videoEmbedUrl(selected.video) : null
          return (
            <>
              {embed && (
                <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, marginBottom: 10, borderRadius: 8, overflow: "hidden", background: "#000" }}>
                  <iframe src={embed} title="Call recording" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: 0 }} />
                </div>
              )}
              {selected.video && !embed && (
                <a href={selected.video} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "#E9532A", wordBreak: "break-all" }}>Open recording ↗</a>
              )}
              {isCoach ? (
                <input
                  key={selected.id + (selected.video ?? "")}
                  defaultValue={selected.video ?? ""}
                  placeholder="Paste YouTube / Loom / Vimeo link…"
                  onBlur={e => { const v = e.target.value.trim(); if (v !== (selected.video ?? "")) patchCall(selected.id, { video: v || null }) }}
                  style={{ width: "100%", marginTop: embed || selected.video ? 8 : 0, padding: "7px 10px", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 13, boxSizing: "border-box" }}
                />
              ) : (!selected.video && <span style={{ fontSize: 13, color: "#C0BAB2" }}>No recording yet.</span>)}
            </>
          )
        })()}
      </Section>

      {/* Recap */}
      {(() => {
        const editing = editingNote?.callId === selected.id && editingNote.field === "synopsis"
        return (
          <Section label="Recap" action={isCoach && !editing && <EditButton onClick={() => setEditingNote({ callId: selected.id, field: "synopsis", value: selected.synopsis ?? "" })} />}>
            {editing ? (
              <textarea
                autoFocus
                defaultValue={editingNote!.value}
                rows={4}
                style={{ width: "100%", border: "1px solid #ECE7DE", borderRadius: 6, padding: 10, fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
                onBlur={e => { saveField(selected.id, "synopsis", e.target.value); setEditingNote(null) }}
              />
            ) : (
              <div style={{ fontSize: 13, color: selected.synopsis ? "#1A1916" : "#C0BAB2", minHeight: 20, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                {selected.synopsis || (isCoach ? "No recap yet — click Edit to add one." : "—")}
              </div>
            )}
          </Section>
        )
      })()}

      {/* Notes */}
      {(() => {
        const editing = editingNote?.callId === selected.id && editingNote.field === "notes"
        return (
          <Section label="Coach Notes" action={isCoach && !editing && <EditButton onClick={() => setEditingNote({ callId: selected.id, field: "notes", value: selected.notes ?? "" })} />}>
            {editing ? (
              <textarea
                autoFocus
                defaultValue={editingNote!.value}
                rows={4}
                style={{ width: "100%", border: "1px solid #ECE7DE", borderRadius: 6, padding: 10, fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
                onBlur={e => { saveField(selected.id, "notes", e.target.value); setEditingNote(null) }}
              />
            ) : (
              <div style={{ fontSize: 13, color: selected.notes ? "#1A1916" : "#C0BAB2", minHeight: 20, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                {selected.notes || (isCoach ? "No notes yet — click Edit to add." : "—")}
              </div>
            )}
          </Section>
        )
      })()}

      {/* Q&A */}
      <Section label="Questions & Actions">
        {selected.questions.map(q => (
          <div key={q.id} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1916", marginBottom: 4, display: "flex", alignItems: "flex-start", gap: 8 }}>
              <span style={{ flex: 1 }}>{q.q}</span>
              {isCoach && (
                <button onClick={() => handleDeleteQuestion(q.id)} title="Delete" style={{ background: "none", border: "none", color: "#C4BFBA", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 0, flexShrink: 0 }}>×</button>
              )}
            </div>
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
                style={{ flex: 1, padding: "7px 10px", border: "1px solid #ECE7DE", borderRadius: 5, fontSize: 13, minWidth: 0 }}
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
    </div>
  )

  function whoFor(call: Call): string | null {
    if (call.isGroupCall) {
      const prog = programs.find(p => p.id === call.programId)
      return prog ? `Group · ${prog.name}` : "Group · unassigned"
    }
    if (embedded) return null // client's own page — the client is obvious
    if (call.isSalesCall) return call.prospectEmail
    if (!call.clientId) return "Needs a client"
    return clients.find(c => c.id === call.clientId)?.name ?? null
  }

  function CallRow({ call }: { call: Call }) {
    const isSel = selected?.id === call.id
    const who = whoFor(call)
    return (
      <div
        onClick={() => setSelected(call)}
        style={
          isMobile
            ? { background: "#fff", border: "1px solid #ECE7DE", borderRadius: 10, padding: "12px 14px", cursor: "pointer" }
            : { padding: "12px 16px", cursor: "pointer", background: isSel ? "#FFF7F4" : "transparent", borderLeft: `3px solid ${isSel ? "#E9532A" : "transparent"}`, borderBottom: "1px solid #F5F1EC" }
        }
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1916", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ flex: 1 }}>{call.title}</span>
          {call.isGroupCall && <GroupBadge />}
          {!call.isGroupCall && !call.isSalesCall && !call.clientId && <DraftBadge />}
        </div>
        <div style={{ fontSize: 11, color: "#9C9590", marginTop: 2 }}>{call.date}{who ? ` · ${who}` : ""}</div>
      </div>
    )
  }

  const loadMore = remaining > 0 && (
    <button
      onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
      style={{ width: "100%", marginTop: isMobile ? 4 : 0, padding: "10px 12px", background: "none", border: "none", borderTop: isMobile ? "none" : "1px solid #F5F1EC", fontSize: 12, fontWeight: 600, color: "#6B6760", cursor: "pointer" }}
    >
      Load {Math.min(PAGE_SIZE, remaining)} more · {remaining} left
    </button>
  )

  return (
    <div>
      <div style={{ display: "flex", justifyContent: embedded ? "flex-end" : "space-between", alignItems: "center", marginBottom: 20 }}>
        {!embedded && <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 28, fontWeight: 600, color: "#1A1916", margin: 0 }}>Calls</h1>}
        {isCoach && (
          <button onClick={() => setAdding(a => !a)} style={{ padding: "7px 16px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            + New Call
          </button>
        )}
      </div>

      {showTabs && (
        <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #ECE7DE", marginBottom: 16 }}>
          {([["client", "Client Calls"], ["sales", "Sales Calls"]] as const).map(([t, label]) => {
            const active = tab === t
            const count = calls.filter(c => inTab(c, t)).length
            return (
              <button
                key={t}
                onClick={() => switchTab(t)}
                style={{ padding: "8px 14px", background: "none", border: "none", borderBottom: `2px solid ${active ? "#E9532A" : "transparent"}`, marginBottom: -1, fontSize: 13, fontWeight: 600, color: active ? "#1A1916" : "#9C9590", cursor: "pointer" }}
              >
                {label} <span style={{ fontWeight: 500, color: "#9C9590" }}>{count}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Add call form */}
      {adding && isCoach && (
        <form onSubmit={handleAddCall} style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 10, padding: 16, marginBottom: 16, display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={{ fontSize: 11, color: "#9C9590", display: "block", marginBottom: 4 }}>Title</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required placeholder="Monthly strategy call" style={{ width: "100%", padding: "7px 10px", border: "1px solid #ECE7DE", borderRadius: 5, fontSize: 13, boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#9C9590", display: "block", marginBottom: 4 }}>Date</label>
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required style={{ padding: "7px 10px", border: "1px solid #ECE7DE", borderRadius: 5, fontSize: 13 }} />
          </div>
          {!(showTabs && tab === "sales") && clients.length > 1 && (
            <div>
              <label style={{ fontSize: 11, color: "#9C9590", display: "block", marginBottom: 4 }}>Client</label>
              <select value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))} style={{ padding: "7px 10px", border: "1px solid #ECE7DE", borderRadius: 5, fontSize: 13 }}>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          {!(showTabs && tab === "sales") && <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#1A1916", cursor: "pointer", padding: "7px 0" }}>
            <input type="checkbox" checked={form.isGroupCall} onChange={e => setForm(f => ({ ...f, isGroupCall: e.target.checked }))} style={{ accentColor: "#E9532A" }} />
            Group call
          </label>}
          {form.isGroupCall && !(showTabs && tab === "sales") && (
            <div>
              <label style={{ fontSize: 11, color: "#9C9590", display: "block", marginBottom: 4 }}>Program</label>
              <select value={form.programId} onChange={e => setForm(f => ({ ...f, programId: e.target.value }))} style={{ padding: "7px 10px", border: "1px solid #ECE7DE", borderRadius: 5, fontSize: 13 }}>
                <option value="">Unassigned — hidden from clients</option>
                {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          <button type="submit" disabled={saving} style={{ padding: "7px 16px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Save</button>
        </form>
      )}

      {sortedCalls.length === 0 ? (
        <div style={{ color: "#9C9590", fontSize: 13, padding: "8px 0" }}>{showTabs && tab === "sales" ? "No sales calls yet." : "No calls yet."}</div>
      ) : isMobile ? (
        // Mobile: single scrolling column; tapping a call expands its notes inline.
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {visibleCalls.map(call =>
            selected?.id === call.id
              ? <div key={call.id}>{detailCard}</div>
              : <CallRow key={call.id} call={call} />
          )}
          {loadMore}
        </div>
      ) : (
        // Desktop: list + detail pane.
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          <div style={sideStyle}>
            {visibleCalls.map(call => <CallRow key={call.id} call={call} />)}
            {loadMore}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>{detailCard}</div>
        </div>
      )}
    </div>
  )
}

function Section({ label, action, children }: { label: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 24, marginBottom: 8 }}>
        <div style={{ fontSize: 10, color: "#9C9590", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {label}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ fontSize: 11, fontWeight: 600, color: "#6B6760", background: "none", border: "1px solid #ECE7DE", borderRadius: 5, padding: "3px 10px", cursor: "pointer" }}>
      Edit
    </button>
  )
}
