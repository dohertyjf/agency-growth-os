"use client"
import { useState } from "react"
import { useFmtCurrency } from "@/lib/CurrencyContext"

interface Contract {
  id: string
  name: string
  monthly: number
  hoursPerMonth: number
  start: string
  contractedThrough: string | null
  status: string
  verbal?: boolean
  type: string
  accountId?: string | null
  ownerId?: string | null
  callDate: string | null
  signedDate: string | null
  kickoffDate: string | null
}

interface Account { id: string; name: string }
interface Person { id: string; name: string; isExternal: boolean }

interface Props {
  clientId: string
  contracts: Contract[]
  accounts: Account[]
  people?: Person[]
  onContractsChange: (contracts: Contract[]) => void
  onAccountCreated?: (account: Account) => void
  noteCounts?: Record<string, number>
}

function AccountPicker({ accounts, value, onChange, clientId, onAccountCreated }: {
  accounts: Account[]
  value: string
  onChange: (id: string) => void
  clientId: string
  onAccountCreated: (account: Account) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const [saving, setSaving] = useState(false)

  const selected = accounts.find(a => a.id === value)
  const filtered = accounts.filter(a => a.name.toLowerCase().includes(search.toLowerCase()))

  function close() { setOpen(false); setSearch(""); setCreating(false); setNewName("") }

  async function handleCreate() {
    if (!newName.trim()) return
    setSaving(true)
    const res = await fetch(`/api/clients/${clientId}/accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    })
    setSaving(false)
    if (!res.ok) return
    const account: Account = await res.json()
    onAccountCreated(account)
    onChange(account.id)
    close()
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          padding: "7px 10px", border: `1px solid ${!value ? "#F59E0B" : "#ECE7DE"}`, borderRadius: 6,
          fontSize: 13, background: "#fff", color: "#1A1916", width: "100%", boxSizing: "border-box",
          fontFamily: "inherit", outline: "none", textAlign: "left", cursor: "pointer",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}
      >
        <span style={{ color: selected ? "#1A1916" : "#9C9590" }}>{selected ? selected.name : "Select account…"}</span>
        <span style={{ color: "#9C9590", fontSize: 10, flexShrink: 0, marginLeft: 4 }}>▾</span>
      </button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={close} />
          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100, background: "#fff", border: "1px solid #ECE7DE", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.1)", marginTop: 2, maxHeight: 240, overflowY: "auto" }}>
            <div style={{ padding: "8px 10px", borderBottom: "1px solid #F5F1EC", position: "sticky", top: 0, background: "#fff" }}>
              <input
                autoFocus
                placeholder="Search accounts…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === "Escape" && close()}
                style={{ width: "100%", border: "none", outline: "none", fontSize: 12, color: "#1A1916", background: "transparent" }}
              />
            </div>
            {!creating ? (
              <button type="button" onClick={() => setCreating(true)}
                style={{ width: "100%", padding: "8px 12px", textAlign: "left", background: "none", border: "none", borderBottom: "1px solid #F5F1EC", fontSize: 12, color: "#E9532A", fontWeight: 600, cursor: "pointer" }}>
                + New account
              </button>
            ) : (
              <div style={{ padding: "8px 10px", borderBottom: "1px solid #F5F1EC", display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  autoFocus
                  placeholder="Account name"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleCreate() } if (e.key === "Escape") { setCreating(false); setNewName("") } }}
                  style={{ flex: 1, padding: "4px 8px", border: "1px solid #ECE7DE", borderRadius: 4, fontSize: 12, outline: "none" }}
                />
                <button type="button" onClick={handleCreate} disabled={saving || !newName.trim()}
                  style={{ padding: "4px 10px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: "pointer", opacity: saving || !newName.trim() ? 0.5 : 1 }}>
                  {saving ? "…" : "Create"}
                </button>
                <button type="button" onClick={() => { setCreating(false); setNewName("") }}
                  style={{ padding: "4px 8px", background: "none", border: "1px solid #ECE7DE", borderRadius: 4, fontSize: 11, cursor: "pointer", color: "#6B6760" }}>
                  ✕
                </button>
              </div>
            )}
            {filtered.map(a => (
              <button key={a.id} type="button" onClick={() => { onChange(a.id); close() }}
                style={{ width: "100%", padding: "7px 12px", textAlign: "left", background: value === a.id ? "#FFF5F2" : "none", border: "none", borderBottom: "1px solid #F5F1EC", fontSize: 12, color: "#1A1916", fontWeight: value === a.id ? 600 : 400, cursor: "pointer" }}>
                {a.name}
              </button>
            ))}
            {filtered.length === 0 && !creating && (
              <div style={{ padding: "10px 12px", fontSize: 12, color: "#9C9590" }}>
                {search ? "No matching accounts" : "No accounts yet"}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function daysSince(d: string | null): number | null {
  if (!d) return null
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
}

function daysBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null
  const diff = new Date(b).getTime() - new Date(a).getTime()
  return Math.max(0, Math.floor(diff / 86400000))
}

function fmtDate(d: string | null): string {
  if (!d) return "—"
  const [y, m, day] = d.split("-")
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  return `${months[+m - 1]} ${+day}, ${y}`
}

function fmtYM(ym: string): string {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  const [y, m] = ym.split("-")
  return `${months[+m - 1]} '${y.slice(2)}`
}

function dealMeta(deal: Contract): string {
  if (deal.type === "oneoff") return `One-off · ${fmtYM(deal.start)}`
  if (deal.contractedThrough) return `Retainer · ${fmtYM(deal.start)} – ${fmtYM(deal.contractedThrough)}`
  return `Retainer · ${fmtYM(deal.start)} – Ongoing`
}

const inputStyle: React.CSSProperties = {
  padding: "7px 10px", border: "1px solid #ECE7DE", borderRadius: 6,
  fontSize: 13, background: "#fff", color: "#1A1916",
  width: "100%", boxSizing: "border-box", fontFamily: "inherit", outline: "none",
}
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "#6B6760", display: "block", marginBottom: 4 }

interface Note { id: string; body: string; kind: string; author: string | null; createdAt: string }

function DealNotes({ contractId, initialCount, onCountChange }: { contractId: string; initialCount: number; onCountChange: (n: number) => void }) {
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [notes, setNotes] = useState<Note[]>([])
  const [count, setCount] = useState(initialCount)
  const [body, setBody] = useState("")
  const [kind, setKind] = useState<"note" | "transcript">("note")
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  function bump(n: number) { setCount(n); onCountChange(n) }

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next && !loaded) {
      setLoading(true)
      const res = await fetch(`/api/contracts/${contractId}/notes`)
      setLoading(false)
      if (res.ok) { const data = await res.json(); setNotes(data); setLoaded(true); bump(data.length) }
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    setSaving(true)
    const res = await fetch(`/api/contracts/${contractId}/notes`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: body.trim(), kind }),
    })
    setSaving(false)
    if (!res.ok) return
    const n = await res.json()
    setNotes(prev => [n, ...prev]); bump(count + 1)
    setBody(""); setKind("note")
  }

  async function del(id: string) {
    await fetch(`/api/contracts/${contractId}/notes?noteId=${id}`, { method: "DELETE" })
    setNotes(prev => prev.filter(n => n.id !== id)); bump(Math.max(0, count - 1))
  }

  return (
    <div style={{ marginTop: 10, borderTop: "1px solid #F5F1EC", paddingTop: 8 }}>
      <button onClick={toggle}
        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#6B6760", padding: 0, display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: "#C0BAB2" }}>{open ? "▾" : "▸"}</span> Call Notes
        {count > 0 && <span style={{ fontSize: 10, background: "#F0EBE3", color: "#6B6760", borderRadius: 99, padding: "1px 7px", fontWeight: 700 }}>{count}</span>}
      </button>

      {open && (
        <div style={{ marginTop: 10 }}>
          <form onSubmit={add} style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
            <textarea value={body} onChange={e => setBody(e.target.value)}
              placeholder={kind === "transcript" ? "Paste the call transcript…" : "What happened on the call — objections, budget, next steps…"}
              rows={kind === "transcript" ? 5 : 3}
              style={{ width: "100%", padding: "8px 10px", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 12, fontFamily: "inherit", outline: "none", resize: "vertical", boxSizing: "border-box", color: "#1A1916" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", border: "1px solid #ECE7DE", borderRadius: 6, overflow: "hidden" }}>
                {(["note", "transcript"] as const).map(k => (
                  <button key={k} type="button" onClick={() => setKind(k)}
                    style={{ padding: "5px 12px", fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer", background: kind === k ? "#E9532A" : "#fff", color: kind === k ? "#fff" : "#6B6760", textTransform: "capitalize" }}>{k}</button>
                ))}
              </div>
              <span style={{ flex: 1 }} />
              <button type="submit" disabled={saving || !body.trim()}
                style={{ padding: "6px 14px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: saving || !body.trim() ? 0.5 : 1 }}>{saving ? "Saving…" : "Save"}</button>
            </div>
          </form>

          {loading && <div style={{ fontSize: 12, color: "#9C9590" }}>Loading…</div>}
          {!loading && notes.length === 0 && <div style={{ fontSize: 12, color: "#C0BAB2" }}>No notes yet.</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {notes.map(n => {
              const isTranscript = n.kind === "transcript"
              const isOpen = expanded[n.id]
              const preview = n.body.length > 220 && isTranscript && !isOpen ? n.body.slice(0, 220) + "…" : n.body
              return (
                <div key={n.id} style={{ borderLeft: `2px solid ${isTranscript ? "#D8CFC2" : "#ECE7DE"}`, paddingLeft: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    {isTranscript && <span style={{ fontSize: 9, fontWeight: 700, color: "#7A6E5C", background: "#F0EBE1", borderRadius: 4, padding: "1px 5px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Transcript</span>}
                    <span style={{ fontSize: 10, color: "#9C9590" }}>{new Date(n.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                    {n.author && <span style={{ fontSize: 10, color: "#C0BAB2" }}>· {n.author}</span>}
                    <span style={{ flex: 1 }} />
                    <button onClick={() => del(n.id)} style={{ background: "none", border: "none", color: "#C0BAB2", cursor: "pointer", fontSize: 10, textDecoration: "underline", padding: 0 }}>delete</button>
                  </div>
                  <div style={{ fontSize: 12, color: "#1A1916", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{preview}</div>
                  {isTranscript && n.body.length > 220 && (
                    <button onClick={() => setExpanded(x => ({ ...x, [n.id]: !isOpen }))}
                      style={{ background: "none", border: "none", color: "#E9532A", cursor: "pointer", fontSize: 11, fontWeight: 600, padding: "2px 0 0" }}>{isOpen ? "Show less" : "Show full transcript"}</button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

type Stage = "opportunity" | "qualified" | "verbal" | "won" | "lost"

function stageOf(c: Contract): Stage {
  if (c.status === "active" || c.status === "finished") return "won"
  if (c.status === "lost") return "lost"
  if (c.status === "potential" && c.verbal) return "verbal"
  if (c.status === "potential") return "qualified"
  return "opportunity"
}

const STAGE_COLS: { stage: Stage; label: string; hint: string; accent: string }[] = [
  { stage: "opportunity", label: "Opportunity", hint: "Initial contact", accent: "#6366F1" },
  { stage: "qualified", label: "Qualified", hint: "In negotiation", accent: "#0EA5E9" },
  { stage: "verbal", label: "Verbal", hint: "Yes — not signed/paid", accent: "#D97706" },
  { stage: "won", label: "Won", hint: "Signed & paid", accent: "#1F7A4D" },
  { stage: "lost", label: "Lost", hint: "Didn't close", accent: "#C2410C" },
]

interface DealCardProps {
  deal: Contract
  accounts: Account[]
  advanceLabel: string
  onAdvance: (id: string) => void
  onLost: (id: string) => void
  onRevert?: (id: string) => void
  onEdit: (deal: Contract) => void
  onDelete: (id: string) => void
  fmt$: (v: number) => string
  noteCount?: number
  onNoteCountChange?: (id: string, n: number) => void
  secondaryLabel?: string
  onSecondary?: (id: string) => void
}

function DealCard({ deal, accounts, advanceLabel, onAdvance, onLost, onRevert, onEdit, onDelete, fmt$, noteCount = 0, onNoteCountChange, secondaryLabel, onSecondary }: DealCardProps) {
  const accountName = deal.accountId ? accounts.find(a => a.id === deal.accountId)?.name : null
  const daysSinceCall = daysSince(deal.callDate)

  return (
    <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 10, padding: "14px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#1A1916" }}>{deal.name}</div>
          {accountName && (
            <div style={{ fontSize: 11, color: "#6B6760", marginTop: 2 }}>{accountName}</div>
          )}
          <div style={{ fontSize: 11, color: "#C0BAB2", marginTop: 2 }}>{dealMeta(deal)}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 6, fontSize: 11, color: "#9C9590" }}>
            {deal.callDate && (
              <span>
                Call: {fmtDate(deal.callDate)}
                {daysSinceCall !== null && <span style={{ color: "#C0BAB2" }}> · {daysSinceCall}d ago</span>}
              </span>
            )}
            {deal.signedDate && (
              <span>Signed: {fmtDate(deal.signedDate)}</span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#1A1916", fontVariantNumeric: "tabular-nums" }}>
            {fmt$(deal.monthly)}<span style={{ fontSize: 11, fontWeight: 400, color: "#9C9590" }}>/mo</span>
          </div>
          <button
            onClick={() => onEdit(deal)}
            style={{ padding: "2px 6px", background: "none", border: "1px solid #ECE7DE", borderRadius: 4, fontSize: 11, color: "#9C9590", cursor: "pointer", lineHeight: 1.4 }}
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(deal.id)}
            title="Delete deal"
            style={{ padding: "2px 6px", background: "none", border: "none", fontSize: 16, color: "#C4BFBA", cursor: "pointer", lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
        {onRevert && (
          <button
            onClick={() => onRevert(deal.id)}
            style={{ padding: "6px 10px", background: "none", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 12, color: "#6B6760", cursor: "pointer", fontWeight: 500 }}
          >
            ← Opportunity
          </button>
        )}
        <button
          onClick={() => onAdvance(deal.id)}
          style={{ flex: 1, padding: "6px 10px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
        >
          {advanceLabel}
        </button>
        {secondaryLabel && onSecondary && (
          <button
            onClick={() => onSecondary(deal.id)}
            style={{ padding: "6px 10px", background: "none", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 12, color: "#1F7A4D", cursor: "pointer", fontWeight: 600 }}
          >
            {secondaryLabel}
          </button>
        )}
        <button
          onClick={() => onLost(deal.id)}
          style={{ padding: "6px 12px", background: "none", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 12, color: "#C2410C", cursor: "pointer", fontWeight: 500 }}
        >
          Lost
        </button>
      </div>
      <DealNotes contractId={deal.id} initialCount={noteCount} onCountChange={n => onNoteCountChange?.(deal.id, n)} />
    </div>
  )
}

interface DealGroupProps {
  title: string
  subtitle: string
  deals: Contract[]
  accounts: Account[]
  advanceLabel: string
  onAdvance: (id: string) => void
  onLost: (id: string) => void
  onRevert?: (id: string) => void
  onEdit: (deal: Contract) => void
  onDelete: (id: string) => void
  fmt$: (v: number) => string
  noteCounts?: Record<string, number>
  onNoteCountChange?: (id: string, n: number) => void
  secondaryLabel?: string
  onSecondary?: (id: string) => void
}

function DealGroup({ title, subtitle, deals, accounts, advanceLabel, onAdvance, onLost, onRevert, onEdit, onDelete, fmt$, noteCounts, onNoteCountChange, secondaryLabel, onSecondary }: DealGroupProps) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#9C9590", textTransform: "uppercase", letterSpacing: "0.05em" }}>{title}</span>
        <span style={{ fontSize: 11, background: "#F5F1EC", color: "#6B6760", borderRadius: 99, padding: "1px 8px", fontWeight: 600 }}>{deals.length}</span>
        <span style={{ fontSize: 11, color: "#C0BAB2" }}>· {subtitle}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {deals.map(deal => (
          <DealCard
            key={deal.id}
            deal={deal}
            accounts={accounts}
            advanceLabel={advanceLabel}
            onAdvance={onAdvance}
            onLost={onLost}
            onRevert={onRevert}
            onEdit={onEdit}
            onDelete={onDelete}
            fmt$={fmt$}
            noteCount={noteCounts?.[deal.id] ?? 0}
            onNoteCountChange={onNoteCountChange}
            secondaryLabel={secondaryLabel}
            onSecondary={onSecondary}
          />
        ))}
        {deals.length === 0 && (
          <div style={{ padding: "12px 16px", background: "#F5F1EC", borderRadius: 8, fontSize: 12, color: "#9C9590" }}>
            No deals in this stage
          </div>
        )}
      </div>
    </div>
  )
}

function BoardCard({ deal, accountName, count, fmt$, onEdit, onSetStage }: {
  deal: Contract; accountName: string | null; count: number; fmt$: (v: number) => string; onEdit: (d: Contract) => void; onSetStage: (id: string, stage: Stage) => void
}) {
  return (
    <div draggable
      onDragStart={e => { e.dataTransfer.setData("text/plain", deal.id); e.dataTransfer.effectAllowed = "move" }}
      style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 8, padding: "9px 11px", cursor: "grab", display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#1A1916", lineHeight: 1.25 }}>{deal.name}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#1A1916", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{fmt$(deal.monthly)}</span>
      </div>
      {accountName && <div style={{ fontSize: 11, color: "#9C9590" }}>{accountName}</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
        {count > 0 && <span title="Call notes" style={{ fontSize: 10, background: "#F0EBE3", color: "#6B6760", borderRadius: 99, padding: "1px 7px", fontWeight: 700 }}>📝 {count}</span>}
        <span style={{ flex: 1 }} />
        <select value={stageOf(deal)} onChange={e => onSetStage(deal.id, e.target.value as Stage)} title="Move stage"
          style={{ fontSize: 10, border: "1px solid #ECE7DE", borderRadius: 4, padding: "1px 4px", color: "#6B6760", background: "#fff", outline: "none", cursor: "pointer", maxWidth: 92 }}>
          {STAGE_COLS.map(c => <option key={c.stage} value={c.stage}>{c.label}</option>)}
        </select>
        <button onClick={() => onEdit(deal)} title="Edit"
          style={{ background: "none", border: "1px solid #ECE7DE", borderRadius: 4, fontSize: 11, color: "#9C9590", cursor: "pointer", padding: "1px 7px", lineHeight: 1.4 }}>Edit</button>
      </div>
    </div>
  )
}

function BoardColumn({ col, deals, accounts, noteCounts, fmt$, onEdit, onSetStage }: {
  col: typeof STAGE_COLS[number]
  deals: Contract[]
  accounts: Account[]
  noteCounts: Record<string, number>
  fmt$: (v: number) => string
  onEdit: (d: Contract) => void
  onSetStage: (id: string, stage: Stage) => void
}) {
  const [over, setOver] = useState(false)
  const bounded = col.stage === "won" || col.stage === "lost"
  const isRecent = (c: Contract) => {
    const d = col.stage === "won" ? (c.signedDate ?? c.start) : (c.callDate ?? c.start)
    const days = daysSince(d)
    return days === null || days <= 90
  }
  const shown = bounded ? deals.filter(isRecent) : deals
  const hidden = deals.length - shown.length
  const sum = deals.reduce((t, c) => t + c.monthly, 0)
  return (
    <div
      onDragOver={e => { e.preventDefault(); if (!over) setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); const id = e.dataTransfer.getData("text/plain"); if (id) onSetStage(id, col.stage) }}
      style={{ minWidth: 224, flex: "1 1 224px", background: over ? "#F3EFE8" : "#FBFAF7", border: `1px solid ${over ? col.accent : "#ECE7DE"}`, borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, paddingBottom: 2 }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: col.accent }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: "#1A1916" }}>{col.label}</span>
        <span style={{ fontSize: 11, background: "#F0EBE3", color: "#6B6760", borderRadius: 99, padding: "0 7px", fontWeight: 700 }}>{deals.length}</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: "#C0BAB2", fontVariantNumeric: "tabular-nums" }}>{sum > 0 ? fmt$(sum) : ""}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7, minHeight: 40 }}>
        {shown.map(deal => (
          <BoardCard key={deal.id} deal={deal} count={noteCounts[deal.id] ?? 0} fmt$={fmt$} onEdit={onEdit} onSetStage={onSetStage}
            accountName={deal.accountId ? accounts.find(a => a.id === deal.accountId)?.name ?? null : null} />
        ))}
        {shown.length === 0 && <div style={{ fontSize: 11, color: "#C0BAB2", textAlign: "center", padding: "8px 0" }}>Drop here</div>}
        {hidden > 0 && <div style={{ fontSize: 10, color: "#C0BAB2", textAlign: "center" }}>+{hidden} older (90+ days)</div>}
      </div>
    </div>
  )
}

function PipelineBoard({ deals, accounts, noteCounts, fmt$, onEdit, onSetStage }: {
  deals: Contract[]
  accounts: Account[]
  noteCounts: Record<string, number>
  fmt$: (v: number) => string
  onEdit: (d: Contract) => void
  onSetStage: (id: string, stage: Stage) => void
}) {
  return (
    <div>
      <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8, alignItems: "stretch" }}>
        {STAGE_COLS.map(col => (
          <BoardColumn key={col.stage} col={col}
            deals={deals.filter(d => stageOf(d) === col.stage)}
            accounts={accounts} noteCounts={noteCounts} fmt$={fmt$} onEdit={onEdit} onSetStage={onSetStage} />
        ))}
      </div>
      <div style={{ fontSize: 11, color: "#9C9590", marginTop: 8 }}>Drag a card between columns to change its stage. Won &amp; Lost show the last 90 days.</div>
    </div>
  )
}

export default function PipelinePanel({ clientId, contracts, accounts: initialAccounts, people = [], onContractsChange, onAccountCreated, noteCounts = {} }: Props) {
  const [liveCounts, setLiveCounts] = useState<Record<string, number>>(noteCounts)
  const handleNoteCountChange = (id: string, n: number) => setLiveCounts(prev => ({ ...prev, [id]: n }))
  const teamMembers = people.filter(p => !p.isExternal)
  const fmt$ = useFmtCurrency()
  const [localAccounts, setLocalAccounts] = useState<Account[]>(initialAccounts)
  const [addOpen, setAddOpen] = useState(false)
  const initYM = new Date().toISOString().slice(0, 7)
  const [addForm, setAddForm] = useState({
    name: "", monthly: "", accountId: "", ownerId: "",
    stage: "opportunity" as "opportunity" | "potential",
    callDate: "",
    type: "retainer" as "retainer" | "ongoing" | "oneoff",
    start: initYM,
    contractedThrough: "",
  })
  const [addSaving, setAddSaving] = useState(false)
  const [view, setView] = useState<"list" | "board">("list")
  const [editDeal, setEditDeal] = useState<Contract | null>(null)
  const [editForm, setEditForm] = useState({
    name: "", monthly: "", accountId: "", ownerId: "", callDate: "", signedDate: "",
    type: "retainer" as "retainer" | "ongoing" | "oneoff",
    start: "",
    contractedThrough: "",
  })
  const [editSaving, setEditSaving] = useState(false)

  function openEdit(deal: Contract) {
    const uiType: "retainer" | "ongoing" | "oneoff" =
      !deal.contractedThrough && deal.type === "retainer" ? "ongoing" : deal.type as "retainer" | "ongoing" | "oneoff"
    setEditDeal(deal)
    setEditForm({
      name: deal.name,
      monthly: String(deal.monthly),
      accountId: deal.accountId ?? "",
      ownerId: deal.ownerId ?? "",
      callDate: deal.callDate ?? "",
      signedDate: deal.signedDate ?? "",
      type: uiType,
      start: deal.start,
      contractedThrough: deal.contractedThrough ?? "",
    })
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault()
    if (!editDeal || !editForm.accountId) return
    setEditSaving(true)
    const isOngoing = editForm.type === "ongoing"
    const res = await fetch(`/api/contracts/${editDeal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editForm.name,
        monthly: parseFloat(editForm.monthly) || 0,
        accountId: editForm.accountId || null,
        ownerId: editForm.ownerId || null,
        callDate: editForm.callDate || null,
        signedDate: editForm.signedDate || null,
        type: isOngoing ? "retainer" : editForm.type,
        start: editForm.start,
        contractedThrough: isOngoing ? null : editForm.type === "oneoff" ? editForm.start : editForm.contractedThrough || null,
      }),
    })
    setEditSaving(false)
    if (!res.ok) return
    const updated = await res.json()
    onContractsChange(contracts.map(c => c.id === editDeal.id ? { ...c, ...updated } : c))
    setEditDeal(null)
  }

  function handleAccountCreated(account: Account) {
    setLocalAccounts(prev => [...prev, account].sort((a, b) => a.name.localeCompare(b.name)))
    onAccountCreated?.(account)
  }

  const today = new Date().toISOString().slice(0, 10)
  const nowYM = today.slice(0, 7)

  // Pipeline = open deals only
  const opportunityDeals = contracts.filter(c => c.status === "opportunity")
  const potentialDeals = contracts.filter(c => c.status === "potential")
  const qualifiedDeals = potentialDeals.filter(c => !c.verbal)
  const verbalDeals = potentialDeals.filter(c => c.verbal)
  const wonDeals = contracts.filter(c => c.status === "active")
  const lostDeals = contracts.filter(c => c.status === "lost")
  const pipeline = [...opportunityDeals, ...potentialDeals]

  // Conversion funnel: cumulative totals per stage
  const totalEntered = opportunityDeals.length + potentialDeals.length + wonDeals.length + lostDeals.length
  const totalProposal = potentialDeals.length + wonDeals.length + lostDeals.length

  // Conversion rates
  const oppToProposalPct = totalEntered > 0 ? Math.round((totalProposal / totalEntered) * 100) : null
  const proposalToWonPct = totalProposal > 0 ? Math.round((wonDeals.length / totalProposal) * 100) : null
  const proposalToLostPct = totalProposal > 0 ? Math.round((lostDeals.length / totalProposal) * 100) : null
  const proposalStillOpenPct = totalProposal > 0 ? Math.round((potentialDeals.length / totalProposal) * 100) : null

  // Stats
  const closeRate = wonDeals.length + lostDeals.length > 0
    ? Math.round((wonDeals.length / (wonDeals.length + lostDeals.length)) * 100)
    : null

  const closeTimes = wonDeals.map(c => daysBetween(c.callDate, c.signedDate)).filter((d): d is number => d !== null)
  const avgTimeToClose = closeTimes.length > 0 ? Math.round(closeTimes.reduce((a, b) => a + b, 0) / closeTimes.length) : null

  const kickoffTimes = wonDeals.map(c => daysBetween(c.signedDate, c.kickoffDate)).filter((d): d is number => d !== null)
  const avgTimeToKickoff = kickoffTimes.length > 0 ? Math.round(kickoffTimes.reduce((a, b) => a + b, 0) / kickoffTimes.length) : null

  async function updateContract(id: string, fields: Record<string, string | boolean | null>) {
    const res = await fetch(`/api/contracts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    })
    if (!res.ok) return
    const updated = await res.json()
    onContractsChange(contracts.map(c => c.id === id ? { ...c, ...updated } : c))
  }

  // Single source of truth for moving a deal between pipeline stages (board DnD + list buttons).
  async function setStage(id: string, stage: Stage) {
    const deal = contracts.find(c => c.id === id)
    const patch: Record<string, string | boolean | null> =
      stage === "opportunity" ? { status: "opportunity", verbal: false }
      : stage === "qualified" ? { status: "potential", verbal: false }
      : stage === "verbal" ? { status: "potential", verbal: true }
      : stage === "won" ? { status: "active", verbal: false }
      : { status: "lost" }
    if (stage === "won" && deal && !deal.signedDate) patch.signedDate = today
    await updateContract(id, patch)
  }

  async function handleDeleteDeal(id: string) {
    const deal = contracts.find(c => c.id === id)
    if (!confirm(`Delete "${deal?.name ?? "this deal"}"? This can't be undone.`)) return
    onContractsChange(contracts.filter(c => c.id !== id))
    await fetch(`/api/contracts/${id}`, { method: "DELETE" })
  }

  async function handleAddDeal(e: React.FormEvent) {
    e.preventDefault()
    if (!addForm.accountId) return
    setAddSaving(true)
    const isOngoing = addForm.type === "ongoing"
    const res = await fetch(`/api/clients/${clientId}/contracts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: addForm.name,
        monthly: parseFloat(addForm.monthly) || 0,
        start: addForm.start || nowYM,
        status: addForm.stage,
        type: isOngoing ? "retainer" : addForm.type,
        contractedThrough: isOngoing ? null : addForm.type === "oneoff" ? (addForm.start || nowYM) : addForm.contractedThrough || null,
        accountId: addForm.accountId || null,
        ownerId: addForm.ownerId || null,
        callDate: addForm.callDate || null,
      }),
    })
    if (res.ok) {
      const created = await res.json()
      onContractsChange([...contracts, { ...created, callDate: created.callDate ?? null, signedDate: created.signedDate ?? null, kickoffDate: created.kickoffDate ?? null }])
      setAddOpen(false)
      setAddForm({ name: "", monthly: "", accountId: "", ownerId: "", stage: "opportunity", callDate: "", type: "retainer", start: nowYM, contractedThrough: "" })
    }
    setAddSaving(false)
  }

  return (
    <div>
      {/* Top bar: title + view toggle + add */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 22, fontWeight: 600, color: "#1A1916", margin: 0 }}>
            Pipeline
          </h2>
          <div style={{ fontSize: 13, color: "#9C9590", marginTop: 2 }}>
            {pipeline.length} open deal{pipeline.length !== 1 ? "s" : ""}
            {pipeline.length > 0 && ` · ${fmt$(pipeline.reduce((s, c) => s + c.monthly, 0))}/mo potential`}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", border: "1px solid #ECE7DE", borderRadius: 6, overflow: "hidden" }}>
            {(["list", "board"] as const).map(v => (
              <button key={v} type="button" onClick={() => setView(v)}
                style={{ padding: "7px 14px", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", background: view === v ? "#1A1916" : "#fff", color: view === v ? "#fff" : "#6B6760", textTransform: "capitalize" }}>{v}</button>
            ))}
          </div>
          <button
            onClick={() => setAddOpen(true)}
            style={{ padding: "8px 18px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            + Add Deal
          </button>
        </div>
      </div>

      {view === "board" ? (
        <PipelineBoard
          deals={contracts}
          accounts={localAccounts}
          noteCounts={liveCounts}
          fmt$={fmt$}
          onEdit={openEdit}
          onSetStage={setStage}
        />
      ) : (
      <div style={{ display: "grid", gridTemplateColumns: "7fr 3fr", gap: 24, alignItems: "start" }}>

      {/* Left: Open Pipeline */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        <DealGroup
          title="Opportunity"
          subtitle="Initial contact made"
          deals={opportunityDeals}
          accounts={localAccounts}
          advanceLabel="→ Qualified"
          onAdvance={id => setStage(id, "qualified")}
          onLost={id => setStage(id, "lost")}
          onEdit={openEdit}
          onDelete={handleDeleteDeal}
          noteCounts={liveCounts}
          onNoteCountChange={handleNoteCountChange}
          fmt$={fmt$}
        />

        <DealGroup
          title="Qualified"
          subtitle="In negotiation"
          deals={qualifiedDeals}
          accounts={localAccounts}
          advanceLabel="🤝 Verbal"
          onAdvance={id => setStage(id, "verbal")}
          secondaryLabel="✓ Won"
          onSecondary={id => setStage(id, "won")}
          onLost={id => setStage(id, "lost")}
          onRevert={id => setStage(id, "opportunity")}
          onEdit={openEdit}
          onDelete={handleDeleteDeal}
          noteCounts={liveCounts}
          onNoteCountChange={handleNoteCountChange}
          fmt$={fmt$}
        />

        <DealGroup
          title="Verbal"
          subtitle="Verbal yes — not signed or paid"
          deals={verbalDeals}
          accounts={localAccounts}
          advanceLabel="✓ Won"
          onAdvance={id => setStage(id, "won")}
          onLost={id => setStage(id, "lost")}
          onRevert={id => setStage(id, "qualified")}
          onEdit={openEdit}
          onDelete={handleDeleteDeal}
          noteCounts={liveCounts}
          onNoteCountChange={handleNoteCountChange}
          fmt$={fmt$}
        />

        {pipeline.length === 0 && opportunityDeals.length === 0 && potentialDeals.length === 0 && (
          <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: 14, color: "#9C9590" }}>No open deals. Hit "+ Add Deal" to start tracking your pipeline.</div>
          </div>
        )}
      </div>

      {/* Right: Conversion Flow */}
      <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 20, position: "sticky", top: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1916", marginBottom: 16 }}>Pipeline Flow</div>

        {totalEntered === 0 ? (
          <div style={{ fontSize: 11, color: "#9C9590", marginBottom: 20 }}>Flow appears once deals are added.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 20 }}>
            {/* Opportunity */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 11 }}>
                <span style={{ color: "#6B6760", fontWeight: 600 }}>Opportunity</span>
                <span style={{ color: "#1A1916", fontWeight: 700 }}>{totalEntered}</span>
              </div>
              <div style={{ height: 10, background: "#F5F1EC", borderRadius: 5, overflow: "hidden" }}>
                <div style={{ height: "100%", width: "100%", background: "#6366F1", borderRadius: 5 }} />
              </div>
            </div>

            {/* Conversion arrow */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 0 6px 4px" }}>
              <span style={{ fontSize: 11, color: "#C0BAB2" }}>↓</span>
              <span style={{ fontSize: 11, color: "#9C9590" }}>
                {oppToProposalPct !== null ? `${oppToProposalPct}% moved to Qualified` : "—"}
              </span>
            </div>

            {/* Potential */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 11 }}>
                <span style={{ color: "#6B6760", fontWeight: 600 }}>Qualified</span>
                <span style={{ color: "#1A1916", fontWeight: 700 }}>{totalProposal}</span>
              </div>
              <div style={{ height: 10, background: "#F5F1EC", borderRadius: 5, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${totalEntered > 0 ? (totalProposal / totalEntered) * 100 : 0}%`, background: "#E9532A", borderRadius: 5, transition: "width 0.4s" }} />
              </div>
            </div>

            {/* Potential breakdown */}
            {totalProposal > 0 && (
              <div style={{ marginTop: 10, marginLeft: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  { label: "Won", count: wonDeals.length, pct: proposalToWonPct, color: "#1F7A4D", bg: "#DCFCE7" },
                  { label: "Lost", count: lostDeals.length, pct: proposalToLostPct, color: "#9C9590", bg: "#F3F4F6" },
                  { label: "Still Open", count: potentialDeals.length, pct: proposalStillOpenPct, color: "#92400E", bg: "#FFF7ED" },
                ].map(row => (
                  <div key={row.label}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, fontSize: 11 }}>
                      <span style={{ color: "#6B6760" }}>{row.label}</span>
                      <span style={{ color: "#1A1916", fontWeight: 600 }}>{row.count} <span style={{ color: "#9C9590", fontWeight: 400 }}>({row.pct ?? 0}%)</span></span>
                    </div>
                    <div style={{ height: 7, background: "#F5F1EC", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${row.pct ?? 0}%`, background: row.color, borderRadius: 4, transition: "width 0.4s" }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ borderTop: "1px solid #ECE7DE", paddingTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          {closeRate !== null ? (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#6B6760" }}>Close Rate</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: closeRate >= 50 ? "#1F7A4D" : "#C2410C" }}>{closeRate}%</span>
            </div>
          ) : (
            <div style={{ fontSize: 11, color: "#9C9590" }}>Close rate appears once deals are won or lost.</div>
          )}
          {avgTimeToClose !== null && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#6B6760" }}>Avg time to close</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#1A1916" }}>{avgTimeToClose}d</span>
            </div>
          )}
          {avgTimeToKickoff !== null && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#6B6760" }}>Avg time to kickoff</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#1A1916" }}>{avgTimeToKickoff}d</span>
            </div>
          )}
        </div>
      </div>
      </div>
      )}

      {/* Add Deal Modal */}
      {addOpen && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={e => { if (e.target === e.currentTarget) setAddOpen(false) }}
        >
          <div style={{ background: "#fff", borderRadius: 14, padding: 28, width: 440, boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
            <h3 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 22, fontWeight: 600, margin: "0 0 20px", color: "#1A1916" }}>
              New Deal
            </h3>
            <form onSubmit={handleAddDeal} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={labelStyle}>Deal Name</label>
                <input style={inputStyle} value={addForm.name}
                  onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Acme Corp SEO Retainer" required />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Monthly Value</label>
                  <div style={{ display: "flex", alignItems: "center", border: "1px solid #ECE7DE", borderRadius: 6, background: "#fff" }}>
                    <span style={{ padding: "0 2px 0 10px", fontSize: 13, color: "#9C9590", flexShrink: 0 }}>$</span>
                    <input
                      style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: "inherit", fontSize: 13, color: "#1A1916", padding: "7px 10px 7px 4px" }}
                      type="number" min={0} step="any" value={addForm.monthly}
                      onChange={e => setAddForm(f => ({ ...f, monthly: e.target.value }))}
                      placeholder="5000" />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Stage</label>
                  <select style={inputStyle} value={addForm.stage}
                    onChange={e => setAddForm(f => ({ ...f, stage: e.target.value as "opportunity" | "potential" }))}>
                    <option value="opportunity">Opportunity</option>
                    <option value="potential">Qualified</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Type</label>
                  <select style={inputStyle} value={addForm.type}
                    onChange={e => setAddForm(f => ({ ...f, type: e.target.value as "retainer" | "ongoing" | "oneoff" }))}>
                    <option value="retainer">Retainer – End Date</option>
                    <option value="ongoing">Retainer – Ongoing</option>
                    <option value="oneoff">One-off</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>{addForm.type === "oneoff" ? "Month" : "Start"}</label>
                  <input style={inputStyle} type="month" value={addForm.start}
                    onChange={e => setAddForm(f => ({ ...f, start: e.target.value }))} required />
                </div>
              </div>
              {addForm.type === "retainer" && (
                <div>
                  <label style={labelStyle}>End Date</label>
                  <input style={inputStyle} type="month" value={addForm.contractedThrough}
                    onChange={e => setAddForm(f => ({ ...f, contractedThrough: e.target.value }))} required />
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Account <span style={{ color: "#E9532A" }}>*</span></label>
                  <AccountPicker
                    accounts={localAccounts}
                    value={addForm.accountId}
                    onChange={id => setAddForm(f => ({ ...f, accountId: id }))}
                    clientId={clientId}
                    onAccountCreated={handleAccountCreated}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Initial Call Date</label>
                  <input style={inputStyle} type="date" value={addForm.callDate}
                    onChange={e => setAddForm(f => ({ ...f, callDate: e.target.value }))} />
                </div>
              </div>
              {teamMembers.length > 0 && (
                <div>
                  <label style={labelStyle}>Owner <span style={{ color: "#C0BAB2", fontWeight: 400 }}>(optional)</span></label>
                  <select style={inputStyle} value={addForm.ownerId}
                    onChange={e => setAddForm(f => ({ ...f, ownerId: e.target.value }))}>
                    <option value="">Unassigned</option>
                    {teamMembers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                <button type="button" onClick={() => setAddOpen(false)}
                  style={{ padding: "8px 16px", background: "none", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 13, cursor: "pointer", color: "#6B6760" }}>
                  Cancel
                </button>
                <button type="submit" disabled={addSaving || !addForm.accountId}
                  style={{ padding: "8px 20px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: addSaving || !addForm.accountId ? 0.5 : 1 }}>
                  {addSaving ? "Adding…" : "Add Deal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Deal Modal */}
      {editDeal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={e => { if (e.target === e.currentTarget) setEditDeal(null) }}
        >
          <div style={{ background: "#fff", borderRadius: 14, padding: 28, width: 440, boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
            <h3 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 22, fontWeight: 600, margin: "0 0 20px", color: "#1A1916" }}>
              Edit Deal
            </h3>
            <form onSubmit={handleEditSave} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={labelStyle}>Deal Name</label>
                <input style={inputStyle} value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  required />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Monthly Value</label>
                  <div style={{ display: "flex", alignItems: "center", border: "1px solid #ECE7DE", borderRadius: 6, background: "#fff" }}>
                    <span style={{ padding: "0 2px 0 10px", fontSize: 13, color: "#9C9590", flexShrink: 0 }}>$</span>
                    <input
                      style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: "inherit", fontSize: 13, color: "#1A1916", padding: "7px 10px 7px 4px" }}
                      type="number" min={0} step="any" value={editForm.monthly}
                      onChange={e => setEditForm(f => ({ ...f, monthly: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Type</label>
                  <select style={inputStyle} value={editForm.type}
                    onChange={e => setEditForm(f => ({ ...f, type: e.target.value as "retainer" | "ongoing" | "oneoff" }))}>
                    <option value="retainer">Retainer – End Date</option>
                    <option value="ongoing">Retainer – Ongoing</option>
                    <option value="oneoff">One-off</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: editForm.type === "retainer" ? "1fr 1fr" : "1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>{editForm.type === "oneoff" ? "Month" : "Start"}</label>
                  <input style={inputStyle} type="month" value={editForm.start}
                    onChange={e => setEditForm(f => ({ ...f, start: e.target.value }))} required />
                </div>
                {editForm.type === "retainer" && (
                  <div>
                    <label style={labelStyle}>End Date</label>
                    <input style={inputStyle} type="month" value={editForm.contractedThrough}
                      onChange={e => setEditForm(f => ({ ...f, contractedThrough: e.target.value }))} required />
                  </div>
                )}
              </div>
              <div>
                <label style={labelStyle}>Account <span style={{ color: "#E9532A" }}>*</span></label>
                <AccountPicker
                  accounts={localAccounts}
                  value={editForm.accountId}
                  onChange={id => setEditForm(f => ({ ...f, accountId: id }))}
                  clientId={clientId}
                  onAccountCreated={handleAccountCreated}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Initial Call Date</label>
                  <input style={inputStyle} type="date" value={editForm.callDate}
                    onChange={e => setEditForm(f => ({ ...f, callDate: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Signed Date</label>
                  <input style={inputStyle} type="date" value={editForm.signedDate}
                    onChange={e => setEditForm(f => ({ ...f, signedDate: e.target.value }))} />
                </div>
              </div>
              {teamMembers.length > 0 && (
                <div>
                  <label style={labelStyle}>Owner <span style={{ color: "#C0BAB2", fontWeight: 400 }}>(optional)</span></label>
                  <select style={inputStyle} value={editForm.ownerId}
                    onChange={e => setEditForm(f => ({ ...f, ownerId: e.target.value }))}>
                    <option value="">Unassigned</option>
                    {teamMembers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                <button type="button" onClick={() => setEditDeal(null)}
                  style={{ padding: "8px 16px", background: "none", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 13, cursor: "pointer", color: "#6B6760" }}>
                  Cancel
                </button>
                <button type="submit" disabled={editSaving || !editForm.accountId}
                  style={{ padding: "8px 20px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: editSaving || !editForm.accountId ? 0.5 : 1 }}>
                  {editSaving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
