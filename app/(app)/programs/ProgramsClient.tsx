"use client"
import { useState } from "react"

interface Program { id: string; name: string; isGroup: boolean; callCount: number; clientIds: string[] }
interface Client { id: string; name: string; status: string }

const isActive = (c: Client) => c.status === "active"

const inputStyle: React.CSSProperties = {
  padding: "8px 12px", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 14,
  background: "#fff", color: "#1A1916", boxSizing: "border-box",
}

function TypeBadge({ isGroup }: { isGroup: boolean }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 8, background: isGroup ? "#EDE9FE" : "#F1F0EC", color: isGroup ? "#6D28D9" : "#9C9590", textTransform: "uppercase", letterSpacing: "0.04em" }}>
      {isGroup ? "Group" : "1:1"}
    </span>
  )
}

function ClientGroup({ label, clients, program, onToggle, muted }: {
  label: string
  clients: Client[]
  program: Program
  onToggle: (programId: string, clientId: string, current: string[]) => void
  muted?: boolean
}) {
  if (clients.length === 0) return null
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#9C9590", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>{label}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 6 }}>
        {clients.map(c => (
          <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: muted ? "#6B6760" : "#1A1916", cursor: "pointer" }}>
            <input type="checkbox" checked={program.clientIds.includes(c.id)} onChange={() => onToggle(program.id, c.id, program.clientIds)} style={{ accentColor: "#E9532A" }} />
            {c.name}
          </label>
        ))}
      </div>
    </div>
  )
}

export default function ProgramsClient({ initialPrograms, allClients }: { initialPrograms: Program[]; allClients: Client[] }) {
  const [programs, setPrograms] = useState<Program[]>(initialPrograms)
  const [newName, setNewName] = useState("")
  const [newIsGroup, setNewIsGroup] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  function patchLocal(id: string, patch: Partial<Program>) {
    setPrograms(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p)
      .sort((a, b) => Number(b.isGroup) - Number(a.isGroup) || a.name.localeCompare(b.name)))
  }

  async function create(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setSaving(true)
    const res = await fetch("/api/programs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, isGroup: newIsGroup }),
    })
    setSaving(false)
    if (res.ok) {
      const p = await res.json()
      setPrograms(prev => [...prev, { id: p.id, name: p.name, isGroup: p.isGroup, callCount: 0, clientIds: [] }]
        .sort((a, b) => Number(b.isGroup) - Number(a.isGroup) || a.name.localeCompare(b.name)))
      setNewName(""); setNewIsGroup(false)
    }
  }

  async function saveRename(id: string) {
    const name = editName.trim()
    if (name) {
      const res = await fetch(`/api/programs/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) })
      if (res.ok) patchLocal(id, { name })
    }
    setEditingId(null)
  }

  async function toggleType(id: string, isGroup: boolean) {
    patchLocal(id, { isGroup })
    await fetch(`/api/programs/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isGroup }) })
  }

  async function toggleClient(programId: string, clientId: string, current: string[]) {
    const next = current.includes(clientId) ? current.filter(c => c !== clientId) : [...current, clientId]
    patchLocal(programId, { clientIds: next })
    await fetch(`/api/programs/${programId}/clients`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientIds: next }) })
  }

  async function remove(p: Program) {
    if (!confirm(`Delete "${p.name}"? Its ${p.clientIds.length} member(s) and ${p.callCount} call(s) become unassigned (nothing is deleted).`)) return
    const res = await fetch(`/api/programs/${p.id}`, { method: "DELETE" })
    if (res.ok) setPrograms(prev => prev.filter(x => x.id !== p.id))
  }

  const assignedIds = new Set(programs.flatMap(p => p.clientIds))
  const activeClients = allClients.filter(isActive)
  const inactiveClients = allClients.filter(c => !isActive(c))
  const unassignedActive = activeClients.filter(c => !assignedIds.has(c.id))

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 28, fontWeight: 600, margin: "0 0 4px", color: "#1A1916" }}>Programs</h1>
        <p style={{ fontSize: 13, color: "#9C9590", margin: 0 }}>Your offerings. Mark each as Group or 1:1, then add clients. Clients in a <strong>Group</strong> program see that program&apos;s group-call recaps; 1:1 programs are just how you categorize clients.</p>
      </div>

      <div style={{ background: unassignedActive.length ? "#FDF6EC" : "#F0FAF4", border: `1px solid ${unassignedActive.length ? "#F5D9A8" : "#BBEFCE"}`, borderRadius: 10, padding: "12px 16px", marginBottom: 20, maxWidth: 640 }}>
        {unassignedActive.length ? (
          <div style={{ fontSize: 13, color: "#92400E" }}>
            <strong>{unassignedActive.length}</strong> active client{unassignedActive.length === 1 ? "" : "s"} not in any program: {unassignedActive.map(c => c.name).join(", ")}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "#166534" }}>✓ Every active client is in at least one program.</div>
        )}
      </div>

      <form onSubmit={create} style={{ display: "flex", gap: 8, marginBottom: 24, maxWidth: 560, alignItems: "center", flexWrap: "wrap" }}>
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="New program name" style={{ ...inputStyle, flex: 1, minWidth: 180 }} />
        <select value={newIsGroup ? "group" : "solo"} onChange={e => setNewIsGroup(e.target.value === "group")} style={inputStyle}>
          <option value="solo">1:1</option>
          <option value="group">Group</option>
        </select>
        <button type="submit" disabled={saving || !newName.trim()} style={{ padding: "8px 18px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: saving || !newName.trim() ? 0.6 : 1 }}>Add</button>
      </form>

      {programs.length === 0 ? (
        <div style={{ color: "#9C9590", fontSize: 13, padding: "32px 0" }}>No programs yet. Add one above.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 640 }}>
          {programs.map(p => (
            <div key={p.id} style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 10, padding: "14px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {editingId === p.id ? (
                  <>
                    <input value={editName} onChange={e => setEditName(e.target.value)} autoFocus style={{ ...inputStyle, flex: 1 }}
                      onKeyDown={e => { if (e.key === "Enter") saveRename(p.id); if (e.key === "Escape") setEditingId(null) }} />
                    <button onClick={() => saveRename(p.id)} style={{ padding: "6px 14px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Save</button>
                    <button onClick={() => setEditingId(null)} style={{ padding: "6px 12px", background: "none", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 12, color: "#6B6760", cursor: "pointer" }}>Cancel</button>
                  </>
                ) : (
                  <>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#1A1916", display: "flex", alignItems: "center", gap: 8 }}>{p.name} <TypeBadge isGroup={p.isGroup} /></div>
                      <div style={{ fontSize: 12, color: "#9C9590", marginTop: 2 }}>{p.clientIds.length} client{p.clientIds.length === 1 ? "" : "s"}{p.isGroup ? ` · ${p.callCount} group call${p.callCount === 1 ? "" : "s"}` : ""}</div>
                    </div>
                    <select value={p.isGroup ? "group" : "solo"} onChange={e => toggleType(p.id, e.target.value === "group")} style={{ ...inputStyle, padding: "5px 8px", fontSize: 12 }}>
                      <option value="solo">1:1</option>
                      <option value="group">Group</option>
                    </select>
                    <button onClick={() => setExpandedId(expandedId === p.id ? null : p.id)} style={{ background: "none", border: "1px solid #ECE7DE", borderRadius: 5, fontSize: 12, color: "#6B6760", cursor: "pointer", padding: "5px 10px" }}>
                      {expandedId === p.id ? "Done" : "Clients"}
                    </button>
                    <button onClick={() => { setEditingId(p.id); setEditName(p.name) }} style={{ background: "none", border: "1px solid #ECE7DE", borderRadius: 5, fontSize: 12, color: "#6B6760", cursor: "pointer", padding: "5px 10px" }}>Rename</button>
                    <button onClick={() => remove(p)} style={{ background: "none", border: "none", color: "#9C9590", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "0 2px" }}>×</button>
                  </>
                )}
              </div>

              {expandedId === p.id && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #F5F1EC" }}>
                  <ClientGroup label="Active clients" clients={activeClients} program={p} onToggle={toggleClient} />
                  {inactiveClients.length > 0 && (
                    <ClientGroup label="Inactive clients" clients={inactiveClients} program={p} onToggle={toggleClient} muted />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
