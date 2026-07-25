"use client"
import { useState } from "react"

interface Person {
  id: string
  name: string
  role: string | null
  billableHours: number
}

interface Props {
  clientId: string
  initialPeople: Person[]
  onPeopleChange?: (people: Person[]) => void
}

const inputStyle: React.CSSProperties = {
  padding: "7px 10px", border: "1px solid #ECE7DE", borderRadius: 6,
  fontSize: 13, background: "#fff", color: "#1A1916",
  width: "100%", boxSizing: "border-box", fontFamily: "inherit", outline: "none",
}

export default function PeoplePanel({ clientId, initialPeople, onPeopleChange }: Props) {
  const [people, setPeople] = useState<Person[]>(initialPeople)
  const [adding, setAdding] = useState(false)
  const [addForm, setAddForm] = useState({ name: "", role: "", billableHours: "" })
  const [addSaving, setAddSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: "", role: "", billableHours: "" })
  const [editSaving, setEditSaving] = useState(false)

  function update(next: Person[]) {
    setPeople(next)
    onPeopleChange?.(next)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAddSaving(true)
    const res = await fetch(`/api/clients/${clientId}/people`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: addForm.name.trim(),
        role: addForm.role.trim() || undefined,
        billableHours: parseFloat(addForm.billableHours) || 0,
      }),
    })
    setAddSaving(false)
    if (res.ok) {
      const created = await res.json()
      update([...people, created])
      setAddForm({ name: "", role: "", billableHours: "" })
      setAdding(false)
    }
  }

  function startEdit(p: Person) {
    setEditingId(p.id)
    setEditForm({ name: p.name, role: p.role ?? "", billableHours: String(p.billableHours) })
  }

  async function handleEditSave(e: React.FormEvent, personId: string) {
    e.preventDefault()
    setEditSaving(true)
    const res = await fetch(`/api/clients/${clientId}/people/${personId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editForm.name.trim(),
        role: editForm.role.trim() || null,
        billableHours: parseFloat(editForm.billableHours) || 0,
      }),
    })
    setEditSaving(false)
    if (res.ok) {
      const updated = await res.json()
      update(people.map(p => p.id === personId ? updated : p))
      setEditingId(null)
    }
  }

  async function handleDelete(personId: string) {
    await fetch(`/api/clients/${clientId}/people/${personId}`, { method: "DELETE" })
    update(people.filter(p => p.id !== personId))
  }

  const totalHours = people.reduce((s, p) => s + p.billableHours, 0)

  return (
    <div>
      <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1916" }}>Team Roster</div>
            <div style={{ fontSize: 11, color: "#9C9590", marginTop: 2 }}>
              {people.length === 0 ? "No people added yet" : `${people.length} ${people.length === 1 ? "person" : "people"} · ${totalHours} hrs/mo total capacity`}
            </div>
          </div>
          <button
            onClick={() => setAdding(a => !a)}
            style={{ padding: "6px 14px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            + Add Person
          </button>
        </div>

        {adding && (
          <form onSubmit={handleAdd} style={{ background: "#FBFAF7", border: "1px solid #ECE7DE", borderRadius: 8, padding: 14, marginBottom: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr auto", gap: 10, alignItems: "end" }}>
              <div>
                <label style={{ fontSize: 11, color: "#9C9590", fontWeight: 600, display: "block", marginBottom: 4 }}>Name</label>
                <input style={{ ...inputStyle, background: "#FBFAF7" }} value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} required placeholder="John Doherty" autoFocus />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#9C9590", fontWeight: 600, display: "block", marginBottom: 4 }}>Role <span style={{ fontWeight: 400 }}>(optional)</span></label>
                <input style={{ ...inputStyle, background: "#FBFAF7" }} value={addForm.role} onChange={e => setAddForm(f => ({ ...f, role: e.target.value }))} placeholder="Consultant" />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#9C9590", fontWeight: 600, display: "block", marginBottom: 4 }}>Billable hrs/mo</label>
                <input style={{ ...inputStyle, background: "#FBFAF7" }} type="number" min={0} step={1} value={addForm.billableHours} onChange={e => setAddForm(f => ({ ...f, billableHours: e.target.value }))} required placeholder="50" />
              </div>
              <button type="submit" disabled={addSaving}
                style={{ padding: "7px 14px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", height: 34, alignSelf: "end" }}>
                {addSaving ? "…" : "Save"}
              </button>
            </div>
          </form>
        )}

        {people.length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Name", "Role", "Billable hrs/mo", ""].map(h => (
                  <th key={h} style={{ textAlign: h === "Billable hrs/mo" ? "right" : "left", fontSize: 11, fontWeight: 600, color: "#9C9590", padding: "4px 8px", borderBottom: "1px solid #ECE7DE" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map(p => (
                <tr key={p.id}>
                  {editingId === p.id ? (
                    <td colSpan={4} style={{ padding: "8px 0" }}>
                      <form onSubmit={e => handleEditSave(e, p.id)} style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr auto auto", gap: 8, alignItems: "end" }}>
                        <input style={inputStyle} value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} required autoFocus />
                        <input style={inputStyle} value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))} placeholder="Role" />
                        <input style={inputStyle} type="number" min={0} step={1} value={editForm.billableHours} onChange={e => setEditForm(f => ({ ...f, billableHours: e.target.value }))} required />
                        <button type="submit" disabled={editSaving}
                          style={{ padding: "7px 12px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                          {editSaving ? "…" : "Save"}
                        </button>
                        <button type="button" onClick={() => setEditingId(null)}
                          style={{ padding: "7px 10px", background: "none", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 12, cursor: "pointer", color: "#6B6760" }}>
                          Cancel
                        </button>
                      </form>
                    </td>
                  ) : (
                    <>
                      <td style={{ padding: "10px 8px", fontSize: 13, color: "#1A1916", fontWeight: 600 }}>{p.name}</td>
                      <td style={{ padding: "10px 8px", fontSize: 13, color: "#6B6760" }}>{p.role ?? <span style={{ color: "#C0BAB2" }}>—</span>}</td>
                      <td style={{ padding: "10px 8px", fontSize: 13, color: "#1A1916", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{p.billableHours} hrs</td>
                      <td style={{ padding: "10px 8px", textAlign: "right", whiteSpace: "nowrap" }}>
                        <button onClick={() => startEdit(p)}
                          style={{ fontSize: 11, color: "#9C9590", background: "none", border: "1px solid #ECE7DE", borderRadius: 5, padding: "3px 10px", cursor: "pointer", marginRight: 6 }}>
                          Edit
                        </button>
                        <button onClick={() => handleDelete(p.id)}
                          style={{ fontSize: 11, color: "#C2410C", background: "none", border: "1px solid #FCA5A5", borderRadius: 5, padding: "3px 10px", cursor: "pointer" }}>
                          Remove
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        ) : !adding && (
          <div style={{ fontSize: 13, color: "#9C9590", padding: "16px 0" }}>
            Add the people doing delivery work — yourself included — with how many hours per month each can commit to clients.
          </div>
        )}

        {people.length > 0 && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #ECE7DE", display: "flex", gap: 24 }}>
            <div>
              <div style={{ fontSize: 11, color: "#9C9590", marginBottom: 2 }}>Total capacity</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#1A1916", fontVariantNumeric: "tabular-nums" }}>{totalHours} hrs/mo</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#9C9590", marginBottom: 2 }}>Team size</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#1A1916" }}>{people.length}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
