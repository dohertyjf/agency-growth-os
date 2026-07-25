"use client"
import { useState, useMemo } from "react"

const ROLES = ["Delivery", "Sales", "Marketing", "Finance", "Operations"] as const
type Role = typeof ROLES[number]

const ROLE_COLORS: Record<Role, { bg: string; text: string }> = {
  Delivery:   { bg: "#EFF6FF", text: "#1D4ED8" },
  Sales:      { bg: "#DCFCE7", text: "#166534" },
  Marketing:  { bg: "#F5F3FF", text: "#5B21B6" },
  Finance:    { bg: "#FFF7ED", text: "#92400E" },
  Operations: { bg: "#F3F4F6", text: "#374151" },
}

function parseRoles(s: string | null): string[] {
  return s ? s.split(",").filter(Boolean) : []
}

function stringifyRoles(roles: string[]): string | null {
  return roles.length ? roles.join(",") : null
}

interface Person {
  id: string
  name: string
  role: string | null
  responsibilities: string | null
  isExternal: boolean
  annualSalary: number
  billableHours: number
  startDate: string | null
  endDate: string | null
}

interface PersonSalaryMonth {
  personId: string
  month: string
  monthlySalary: number
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
  initialSalaryMonths: PersonSalaryMonth[]
  onPeopleChange?: (people: Person[]) => void
  onSalaryMonthChange?: (sm: PersonSalaryMonth) => void
}

const inputStyle: React.CSSProperties = {
  padding: "7px 10px", border: "1px solid #ECE7DE", borderRadius: 6,
  fontSize: 13, background: "#fff", color: "#1A1916",
  width: "100%", boxSizing: "border-box", fontFamily: "inherit", outline: "none",
}
const labelStyle: React.CSSProperties = { fontSize: 11, color: "#9C9590", fontWeight: 600, display: "block", marginBottom: 4 }

function RoleChip({ role }: { role: string }) {
  const colors = ROLE_COLORS[role as Role] ?? { bg: "#F3F4F6", text: "#374151" }
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 4, background: colors.bg, color: colors.text, whiteSpace: "nowrap" }}>
      {role}
    </span>
  )
}

function RolePicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false)

  function toggle(role: string) {
    onChange(value.includes(role) ? value.filter(r => r !== role) : [...value, role])
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{ ...inputStyle, textAlign: "left", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}
      >
        {value.length > 0 ? (
          <span style={{ display: "flex", flexWrap: "wrap", gap: 4, flex: 1 }}>
            {value.map(r => <RoleChip key={r} role={r} />)}
          </span>
        ) : (
          <span style={{ color: "#9C9590" }}>Select roles…</span>
        )}
        <span style={{ color: "#9C9590", fontSize: 10, flexShrink: 0 }}>▾</span>
      </button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setOpen(false)} />
          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100, background: "#fff", border: "1px solid #ECE7DE", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.1)", marginTop: 2 }}>
            {ROLES.map(role => (
              <label
                key={role}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid #F5F1EC" }}
                onClick={e => { e.preventDefault(); toggle(role) }}
              >
                <div style={{
                  width: 16, height: 16, borderRadius: 4, border: `2px solid ${value.includes(role) ? "#E9532A" : "#ECE7DE"}`,
                  background: value.includes(role) ? "#E9532A" : "#fff", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {value.includes(role) && <span style={{ color: "#fff", fontSize: 10, lineHeight: 1 }}>✓</span>}
                </div>
                <RoleChip role={role} />
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function fmtSalary(n: number) {
  if (!n) return "—"
  return "$" + Math.round(n).toLocaleString()
}

function fmtDate(d: string): string {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  const [y, m, day] = d.split("-")
  if (day) return `${months[+m - 1]} ${+day}, ${y}`
  return `${months[+m - 1]} ${y}`
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

const emptyAddForm = { name: "", role: "", responsibilities: [] as string[], isExternal: false, annualSalary: "", billableHours: "", startDate: "", endDate: "" }

export default function PeoplePanel({ clientId, initialPeople, initialSalaryMonths, onPeopleChange, onSalaryMonthChange }: Props) {
  const [people, setPeople] = useState<Person[]>(initialPeople)
  const [salaryMonths, setSalaryMonths] = useState<PersonSalaryMonth[]>(initialSalaryMonths)
  const [mode, setMode] = useState<"none" | "add" | "bulk">("none")
  const [addForm, setAddForm] = useState(emptyAddForm)
  const [addSaving, setAddSaving] = useState(false)
  const [editingPerson, setEditingPerson] = useState<Person | null>(null)
  const [editForm, setEditForm] = useState({ name: "", role: "", responsibilities: [] as string[], isExternal: false, annualSalary: "", billableHours: "", startDate: "", endDate: "" })
  const [editSaving, setEditSaving] = useState(false)

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
        responsibilities: stringifyRoles(addForm.responsibilities),
        isExternal: addForm.isExternal,
        annualSalary: parseFloat(addForm.annualSalary) || 0,
        billableHours: parseFloat(addForm.billableHours) || 0,
        startDate: addForm.startDate || null,
        endDate: addForm.endDate || null,
      }),
    })
    setAddSaving(false)
    if (res.ok) {
      const created = await res.json()
      update([...people, created])
      setAddForm(emptyAddForm)
      setMode("none")
    }
  }

  function startEdit(p: Person) {
    setEditingPerson(p)
    setEditForm({
      name: p.name,
      role: p.role ?? "",
      responsibilities: parseRoles(p.responsibilities),
      isExternal: p.isExternal,
      annualSalary: p.annualSalary ? String(p.annualSalary) : "",
      billableHours: String(p.billableHours),
      startDate: p.startDate ?? "",
      endDate: p.endDate ?? "",
    })
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault()
    if (!editingPerson) return
    setEditSaving(true)
    const res = await fetch(`/api/clients/${clientId}/people/${editingPerson.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editForm.name.trim(),
        role: editForm.role.trim() || null,
        responsibilities: stringifyRoles(editForm.responsibilities),
        isExternal: editForm.isExternal,
        annualSalary: parseFloat(editForm.annualSalary) || 0,
        billableHours: parseFloat(editForm.billableHours) || 0,
        startDate: editForm.startDate || null,
        endDate: editForm.endDate || null,
      }),
    })
    setEditSaving(false)
    if (res.ok) {
      const updated = await res.json()
      update(people.map(p => p.id === editingPerson.id ? updated : p))
      setEditingPerson(null)
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

  function handleSalaryMonthUpdate(sm: PersonSalaryMonth) {
    setSalaryMonths(prev => {
      const idx = prev.findIndex(s => s.personId === sm.personId && s.month === sm.month)
      const next = idx >= 0 ? prev.map((s, i) => i === idx ? sm : s) : [...prev, sm]
      return next
    })
    onSalaryMonthChange?.(sm)
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
                {["Name", "Title", "Responsibilities", "Annual Salary", "Billable hrs/mo", ""].map(h => (
                  <th key={h} style={{ textAlign: h === "Annual Salary" || h === "Billable hrs/mo" ? "right" : "left", fontSize: 11, fontWeight: 600, color: "#9C9590", padding: "4px 8px", borderBottom: "1px solid #ECE7DE" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map(p => (
                <tr key={p.id}>
                  <td style={{ padding: "10px 8px" }}>
                    <div style={{ fontSize: 13, color: "#1A1916", fontWeight: 600 }}>{p.name}</div>
                    {(p.startDate || p.endDate) && (
                      <div style={{ fontSize: 11, color: "#C0BAB2", marginTop: 1 }}>
                        {p.startDate ? fmtDate(p.startDate) : "?"} – {p.endDate ? fmtDate(p.endDate) : "present"}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "10px 8px", fontSize: 13, color: "#6B6760" }}>{p.role ?? <span style={{ color: "#C0BAB2" }}>—</span>}</td>
                  <td style={{ padding: "10px 8px" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
                      {parseRoles(p.responsibilities).map(r => <RoleChip key={r} role={r} />)}
                      {p.isExternal && (
                        <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 4, background: "#FEF9C3", color: "#92400E", whiteSpace: "nowrap" }}>
                          External
                        </span>
                      )}
                      {!p.responsibilities && !p.isExternal && <span style={{ color: "#C0BAB2", fontSize: 13 }}>—</span>}
                    </div>
                  </td>
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

      {/* Add Person Modal */}
      {mode === "add" && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={e => { if (e.target === e.currentTarget) { setMode("none"); setAddForm(emptyAddForm) } }}
        >
          <div style={{ background: "#fff", borderRadius: 14, padding: 28, width: 480, boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
            <h3 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 22, fontWeight: 600, margin: "0 0 20px", color: "#1A1916" }}>Add Person</h3>
            <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Name</label>
                  <input style={inputStyle} value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} required placeholder="Jane Smith" autoFocus />
                </div>
                <div>
                  <label style={labelStyle}>Title <span style={{ fontWeight: 400 }}>(optional)</span></label>
                  <input style={inputStyle} value={addForm.role} onChange={e => setAddForm(f => ({ ...f, role: e.target.value }))} placeholder="Owner" />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Responsibilities</label>
                <RolePicker value={addForm.responsibilities} onChange={v => setAddForm(f => ({ ...f, responsibilities: v }))} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Annual Salary $</label>
                  <input style={inputStyle} type="number" min={0} step={1} value={addForm.annualSalary} onChange={e => setAddForm(f => ({ ...f, annualSalary: e.target.value }))} placeholder="60000" />
                </div>
                <div>
                  <label style={labelStyle}>Billable hrs/mo</label>
                  <input style={inputStyle} type="number" min={0} step={1} value={addForm.billableHours} onChange={e => setAddForm(f => ({ ...f, billableHours: e.target.value }))} required placeholder="50" />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Start Date <span style={{ fontWeight: 400 }}>(optional)</span></label>
                  <input style={inputStyle} type="date" value={addForm.startDate} onChange={e => setAddForm(f => ({ ...f, startDate: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>End Date <span style={{ fontWeight: 400 }}>(optional)</span></label>
                  <input style={inputStyle} type="date" value={addForm.endDate} onChange={e => setAddForm(f => ({ ...f, endDate: e.target.value }))} />
                </div>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#6B6760", cursor: "pointer" }}>
                <input type="checkbox" checked={addForm.isExternal} onChange={e => setAddForm(f => ({ ...f, isExternal: e.target.checked }))} />
                External / Vendor
              </label>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                <button type="button" onClick={() => { setMode("none"); setAddForm(emptyAddForm) }}
                  style={{ padding: "8px 16px", background: "none", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 13, cursor: "pointer", color: "#6B6760" }}>
                  Cancel
                </button>
                <button type="submit" disabled={addSaving}
                  style={{ padding: "8px 20px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  {addSaving ? "Saving…" : "Add Person"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Monthly Salary Table */}
      {people.length > 0 && (
        <PersonSalaryTable
          people={people}
          salaryMonths={salaryMonths}
          clientId={clientId}
          onSalaryMonthChange={handleSalaryMonthUpdate}
        />
      )}

      {/* Edit Person Modal */}
      {editingPerson && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={e => { if (e.target === e.currentTarget) setEditingPerson(null) }}
        >
          <div style={{ background: "#fff", borderRadius: 14, padding: 28, width: 480, boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
            <h3 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 22, fontWeight: 600, margin: "0 0 20px", color: "#1A1916" }}>Edit Person</h3>
            <form onSubmit={handleEditSave} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Name</label>
                  <input style={inputStyle} value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} required autoFocus />
                </div>
                <div>
                  <label style={labelStyle}>Title <span style={{ fontWeight: 400 }}>(optional)</span></label>
                  <input style={inputStyle} value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))} placeholder="Owner" />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Responsibilities</label>
                <RolePicker value={editForm.responsibilities} onChange={v => setEditForm(f => ({ ...f, responsibilities: v }))} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Annual Salary $</label>
                  <input style={inputStyle} type="number" min={0} step={1} value={editForm.annualSalary} onChange={e => setEditForm(f => ({ ...f, annualSalary: e.target.value }))} placeholder="60000" />
                </div>
                <div>
                  <label style={labelStyle}>Billable hrs/mo</label>
                  <input style={inputStyle} type="number" min={0} step={1} value={editForm.billableHours} onChange={e => setEditForm(f => ({ ...f, billableHours: e.target.value }))} required placeholder="50" />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Start Date <span style={{ fontWeight: 400 }}>(optional)</span></label>
                  <input style={inputStyle} type="date" value={editForm.startDate} onChange={e => setEditForm(f => ({ ...f, startDate: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>End Date <span style={{ fontWeight: 400 }}>(optional)</span></label>
                  <input style={inputStyle} type="date" value={editForm.endDate} onChange={e => setEditForm(f => ({ ...f, endDate: e.target.value }))} />
                </div>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#6B6760", cursor: "pointer" }}>
                <input type="checkbox" checked={editForm.isExternal} onChange={e => setEditForm(f => ({ ...f, isExternal: e.target.checked }))} />
                External / Vendor
              </label>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                <button type="button" onClick={() => setEditingPerson(null)}
                  style={{ padding: "8px 16px", background: "none", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 13, cursor: "pointer", color: "#6B6760" }}>
                  Cancel
                </button>
                <button type="submit" disabled={editSaving}
                  style={{ padding: "8px 20px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
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

function genMonths(nowYM: string, count: number): string[] {
  const [y, m] = nowYM.split("-").map(Number)
  return Array.from({ length: count }, (_, i) => {
    const total = (y * 12 + (m - 1)) - i
    const ny = Math.floor(total / 12)
    const nm = (total % 12) + 1
    return `${ny}-${String(nm).padStart(2, "0")}`
  })
}

function fmtYM(ym: string): string {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  const [y, m] = ym.split("-")
  return `${months[+m - 1]} '${y.slice(2)}`
}

function PersonSalaryTable({ people, salaryMonths, clientId, onSalaryMonthChange }: {
  people: Person[]
  salaryMonths: PersonSalaryMonth[]
  clientId: string
  onSalaryMonthChange: (sm: PersonSalaryMonth) => void
}) {
  const nowYM = new Date().toISOString().slice(0, 7)
  const months = genMonths(nowYM, 13)

  const salaryMap = new Map<string, number>()
  salaryMonths.forEach(sm => salaryMap.set(`${sm.personId}:${sm.month}`, sm.monthlySalary))

  const [editingCell, setEditingCell] = useState<{ personId: string; month: string } | null>(null)
  const [editValue, setEditValue] = useState("")
  const [saving, setSaving] = useState(false)

  function baseMonthlySalary(p: Person) {
    return p.annualSalary > 0 ? Math.round(p.annualSalary / 12) : 0
  }

  function cellValue(personId: string, month: string, p: Person) {
    const override = salaryMap.get(`${personId}:${month}`)
    return { value: override ?? baseMonthlySalary(p), isOverride: override !== undefined }
  }

  async function saveCell(personId: string, month: string) {
    const raw = editValue.replace(/[$,\s]/g, "")
    const val = parseFloat(raw)
    if (isNaN(val) || val < 0) { setEditingCell(null); return }
    setSaving(true)
    const res = await fetch(`/api/clients/${clientId}/people/${personId}/salary-months`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, monthlySalary: val }),
    })
    setSaving(false)
    if (res.ok) onSalaryMonthChange({ personId, month, monthlySalary: val })
    setEditingCell(null)
  }

  function openCell(personId: string, month: string, currentValue: number) {
    setEditingCell({ personId, month })
    setEditValue(currentValue > 0 ? String(currentValue) : "")
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 20, marginTop: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1916", marginBottom: 4 }}>Monthly Salary</div>
      <div style={{ fontSize: 11, color: "#9C9590", marginBottom: 14 }}>
        Grey values derive from annual salary. Click a cell to set an override — e.g. after a raise taking effect next month.
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", minWidth: "100%" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", fontSize: 11, fontWeight: 600, color: "#9C9590", padding: "4px 16px 4px 0", borderBottom: "1px solid #ECE7DE", minWidth: 140, whiteSpace: "nowrap" }}>
                Person
              </th>
              {months.map(mo => (
                <th key={mo} style={{ textAlign: "right", fontSize: 11, fontWeight: 600, color: mo === nowYM ? "#E9532A" : "#9C9590", padding: "4px 8px", borderBottom: "1px solid #ECE7DE", whiteSpace: "nowrap" }}>
                  {fmtYM(mo)}{mo === nowYM ? " ●" : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {people.map(p => (
              <tr key={p.id}>
                <td style={{ padding: "8px 16px 8px 0", fontSize: 13, fontWeight: 500, color: "#1A1916", borderBottom: "1px solid #F5F1EC", whiteSpace: "nowrap" }}>
                  {p.name}
                </td>
                {months.map(mo => {
                  const { value, isOverride } = cellValue(p.id, mo, p)
                  const isEditing = editingCell?.personId === p.id && editingCell.month === mo
                  return (
                    <td key={mo} style={{ padding: "4px 4px", textAlign: "right", borderBottom: "1px solid #F5F1EC", minWidth: 86 }}>
                      {isEditing ? (
                        <input
                          autoFocus
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={() => saveCell(p.id, mo)}
                          onKeyDown={e => {
                            if (e.key === "Enter") { e.preventDefault(); saveCell(p.id, mo) }
                            if (e.key === "Escape") setEditingCell(null)
                          }}
                          disabled={saving}
                          style={{ width: 78, textAlign: "right", fontSize: 12, border: "1px solid #E9532A", borderRadius: 4, padding: "3px 6px", outline: "none", fontFamily: "inherit", fontVariantNumeric: "tabular-nums" }}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => openCell(p.id, mo, value)}
                          style={{
                            background: "none", border: "none", cursor: "pointer", padding: "3px 8px",
                            fontSize: 12, fontVariantNumeric: "tabular-nums", borderRadius: 4,
                            color: isOverride ? "#1A1916" : "#C0BAB2",
                            fontWeight: isOverride ? 600 : 400,
                            width: "100%", textAlign: "right",
                          }}
                        >
                          {value > 0 ? ("$" + value.toLocaleString()) : "—"}
                        </button>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
