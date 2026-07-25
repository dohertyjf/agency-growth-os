"use client"
import { useState, useMemo } from "react"

interface Person {
  id: string
  name: string
  role: string | null
  annualSalary: number
  billableHours: number
}

interface BulkRow {
  name: string
  role: string
  annualSalary: number
  billableHours: number
  error?: string
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

function fmtSalary(n: number) {
  if (!n) return "—"
  return "$" + Math.round(n).toLocaleString()
}

function parseBulkText(text: string): BulkRow[] {
  return text
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean)
    .map(line => {
      const parts = line.split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(p => p.trim().replace(/^"|"$/g, ""))
      const name = parts[0] ?? ""
      const role = parts[1] ?? ""
      const annualSalary = parseFloat((parts[2] ?? "").replace(/[$,]/g, "")) || 0
      const billableHours = parseFloat(parts[3] ?? "") || 0
      return { name, role, annualSalary, billableHours, error: !name ? "Name required" : undefined }
    })
}

export default function PeoplePanel({ clientId, initialPeople, onPeopleChange }: Props) {
  const [people, setPeople] = useState<Person[]>(initialPeople)
  const [mode, setMode] = useState<"none" | "add" | "bulk">("none")
  const [addForm, setAddForm] = useState({ name: "", role: "", annualSalary: "", billableHours: "" })
  const [addSaving, setAddSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: "", role: "", annualSalary: "", billableHours: "" })
  const [editSaving, setEditSaving] = useState(false)

  // Bulk
  const [bulkText, setBulkText] = useState("")
  const [bulkSaving, setBulkSaving] = useState(false)
  const bulkRows = useMemo(() => bulkText.trim() ? parseBulkText(bulkText) : [], [bulkText])
  const bulkValid = bulkRows.filter(r => !r.error)
  const bulkErrors = bulkRows.filter(r => r.error)

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
        annualSalary: parseFloat(addForm.annualSalary) || 0,
        billableHours: parseFloat(addForm.billableHours) || 0,
      }),
    })
    setAddSaving(false)
    if (res.ok) {
      const created = await res.json()
      update([...people, created])
      setAddForm({ name: "", role: "", annualSalary: "", billableHours: "" })
      setMode("none")
    }
  }

  function startEdit(p: Person) {
    setEditingId(p.id)
    setEditForm({ name: p.name, role: p.role ?? "", annualSalary: p.annualSalary ? String(p.annualSalary) : "", billableHours: String(p.billableHours) })
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
        annualSalary: parseFloat(editForm.annualSalary) || 0,
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

  async function handleBulkImport() {
    if (!bulkValid.length) return
    setBulkSaving(true)
    const res = await fetch(`/api/clients/${clientId}/people/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bulkValid.map(r => ({
        name: r.name,
        role: r.role || undefined,
        annualSalary: r.annualSalary,
        billableHours: r.billableHours,
      }))),
    })
    setBulkSaving(false)
    if (res.ok) {
      const created = await res.json()
      update([...people, ...created])
      setBulkText("")
      setMode("none")
    }
  }

  const totalHours = people.reduce((s, p) => s + p.billableHours, 0)
  const totalSalaries = people.reduce((s, p) => s + p.annualSalary, 0)

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
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setMode(mode === "bulk" ? "none" : "bulk")}
              style={{ padding: "6px 14px", background: "none", color: "#6B6760", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >
              Bulk import
            </button>
            <button
              onClick={() => setMode(mode === "add" ? "none" : "add")}
              style={{ padding: "6px 14px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >
              + Add Person
            </button>
          </div>
        </div>

        {/* Single add form */}
        {mode === "add" && (
          <form onSubmit={handleAdd} style={{ background: "#FBFAF7", border: "1px solid #ECE7DE", borderRadius: 8, padding: 14, marginBottom: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
              <div>
                <label style={{ fontSize: 11, color: "#9C9590", fontWeight: 600, display: "block", marginBottom: 4 }}>Name</label>
                <input style={{ ...inputStyle, background: "#FBFAF7" }} value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} required placeholder="Jane Smith" autoFocus />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#9C9590", fontWeight: 600, display: "block", marginBottom: 4 }}>Title <span style={{ fontWeight: 400 }}>(optional)</span></label>
                <input style={{ ...inputStyle, background: "#FBFAF7" }} value={addForm.role} onChange={e => setAddForm(f => ({ ...f, role: e.target.value }))} placeholder="Consultant" />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#9C9590", fontWeight: 600, display: "block", marginBottom: 4 }}>Annual Salary $</label>
                <input style={{ ...inputStyle, background: "#FBFAF7" }} type="number" min={0} step={1000} value={addForm.annualSalary} onChange={e => setAddForm(f => ({ ...f, annualSalary: e.target.value }))} placeholder="60000" />
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

        {/* Bulk import */}
        {mode === "bulk" && (
          <div style={{ background: "#FBFAF7", border: "1px solid #ECE7DE", borderRadius: 8, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "#6B6760", marginBottom: 8 }}>
              Paste rows — one per line, comma- or tab-separated: <span style={{ fontFamily: "monospace", background: "#ECE7DE", padding: "1px 5px", borderRadius: 3 }}>Name, Title, Annual Salary, Hours/mo</span>
            </div>
            <textarea
              autoFocus
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
              placeholder={"Jane Smith, Consultant, 75000, 50\nBob Jones, Strategist, 90000, 40"}
              style={{ ...inputStyle, background: "#fff", minHeight: 100, resize: "vertical", fontFamily: "monospace", fontSize: 12 }}
            />

            {bulkRows.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>
                      {["Name", "Title", "Annual Salary", "Hrs/mo", ""].map(h => (
                        <th key={h} style={{ textAlign: "left", fontSize: 11, fontWeight: 600, color: "#9C9590", padding: "3px 6px", borderBottom: "1px solid #ECE7DE" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bulkRows.map((r, i) => (
                      <tr key={i} style={{ background: r.error ? "#FEF2F2" : "transparent" }}>
                        <td style={{ padding: "4px 6px", color: r.error ? "#C2410C" : "#1A1916" }}>{r.name || <span style={{ color: "#C2410C" }}>missing</span>}</td>
                        <td style={{ padding: "4px 6px", color: "#6B6760" }}>{r.role || "—"}</td>
                        <td style={{ padding: "4px 6px", color: "#6B6760" }}>{r.annualSalary ? fmtSalary(r.annualSalary) : "—"}</td>
                        <td style={{ padding: "4px 6px", color: "#6B6760" }}>{r.billableHours || "—"}</td>
                        <td style={{ padding: "4px 6px", color: "#C2410C", fontSize: 11 }}>{r.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center" }}>
                  <button
                    onClick={handleBulkImport}
                    disabled={bulkSaving || !bulkValid.length}
                    style={{ padding: "7px 16px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: bulkValid.length ? "pointer" : "not-allowed", opacity: bulkValid.length ? 1 : 0.5 }}
                  >
                    {bulkSaving ? "Importing…" : `Import ${bulkValid.length} ${bulkValid.length === 1 ? "person" : "people"}`}
                  </button>
                  {bulkErrors.length > 0 && (
                    <span style={{ fontSize: 11, color: "#C2410C" }}>{bulkErrors.length} row{bulkErrors.length > 1 ? "s" : ""} will be skipped (missing name)</span>
                  )}
                  <button onClick={() => { setBulkText(""); setMode("none") }}
                    style={{ padding: "7px 10px", background: "none", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 12, cursor: "pointer", color: "#6B6760", marginLeft: "auto" }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {people.length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Name", "Title", "Annual Salary", "Billable hrs/mo", ""].map(h => (
                  <th key={h} style={{ textAlign: h === "Annual Salary" || h === "Billable hrs/mo" ? "right" : "left", fontSize: 11, fontWeight: 600, color: "#9C9590", padding: "4px 8px", borderBottom: "1px solid #ECE7DE" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map(p => (
                <tr key={p.id}>
                  {editingId === p.id ? (
                    <td colSpan={5} style={{ padding: "8px 0" }}>
                      <form onSubmit={e => handleEditSave(e, p.id)} style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr auto auto", gap: 8, alignItems: "end" }}>
                        <input style={inputStyle} value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} required autoFocus />
                        <input style={inputStyle} value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))} placeholder="Title" />
                        <input style={inputStyle} type="number" min={0} step={1000} value={editForm.annualSalary} onChange={e => setEditForm(f => ({ ...f, annualSalary: e.target.value }))} placeholder="Annual salary" />
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
                      <td style={{ padding: "10px 8px", fontSize: 13, color: "#1A1916", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtSalary(p.annualSalary)}</td>
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
        ) : mode === "none" && (
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
            {totalSalaries > 0 && (
              <div>
                <div style={{ fontSize: 11, color: "#9C9590", marginBottom: 2 }}>Total annual salaries</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#1A1916", fontVariantNumeric: "tabular-nums" }}>{fmtSalary(totalSalaries)}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
