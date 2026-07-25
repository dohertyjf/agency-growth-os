"use client"
import { useState, useMemo, useRef, useEffect } from "react"
import { useFmtCurrency } from "@/lib/CurrencyContext"

const CORE_ROLES = ["Delivery", "Sales", "Marketing", "Finance", "Operations"] as const
type CoreRole = typeof CORE_ROLES[number]

const CORE_ROLE_COLORS: Record<CoreRole, { bg: string; text: string }> = {
  Delivery:   { bg: "#EFF6FF", text: "#1D4ED8" },
  Sales:      { bg: "#DCFCE7", text: "#166534" },
  Marketing:  { bg: "#F5F3FF", text: "#5B21B6" },
  Finance:    { bg: "#FFF7ED", text: "#92400E" },
  Operations: { bg: "#F3F4F6", text: "#374151" },
}

const STATUS_STYLES = {
  active:   { bg: "#DCFCE7", text: "#166534", label: "Active" },
  upcoming: { bg: "#DBEAFE", text: "#1E40AF", label: "Upcoming" },
  ended:    { bg: "#F3F4F6", text: "#6B6760", label: "Ended" },
}

function personStatus(p: Person): "active" | "upcoming" | "ended" {
  const now = new Date().toISOString().slice(0, 10)
  if (p.endDate && p.endDate < now) return "ended"
  if (p.startDate && p.startDate > now) return "upcoming"
  return "active"
}

function parseCoreRoles(s: string | null): string[] {
  if (!s) return []
  // Only return values that are actual core role names
  return s.split(",").filter(r => (CORE_ROLES as readonly string[]).includes(r))
}

function stringifyCoreRoles(roles: string[]): string | null {
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

function CoreRoleChip({ role }: { role: string }) {
  const colors = CORE_ROLE_COLORS[role as CoreRole] ?? { bg: "#F3F4F6", text: "#374151" }
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 4, background: colors.bg, color: colors.text, whiteSpace: "nowrap" }}>
      {role}
    </span>
  )
}

function StatusBadge({ status }: { status: "active" | "upcoming" | "ended" }) {
  const s = STATUS_STYLES[status]
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: s.bg, color: s.text, textTransform: "uppercase", letterSpacing: "0.04em" }}>
      {s.label}
    </span>
  )
}

function CoreRolePicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false)
  function toggle(role: string) {
    onChange(value.includes(role) ? value.filter(r => r !== role) : [...value, role])
  }
  return (
    <div style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ ...inputStyle, textAlign: "left", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
        {value.length > 0 ? (
          <span style={{ display: "flex", flexWrap: "wrap", gap: 4, flex: 1 }}>
            {value.map(r => <CoreRoleChip key={r} role={r} />)}
          </span>
        ) : (
          <span style={{ color: "#9C9590" }}>Select core roles…</span>
        )}
        <span style={{ color: "#9C9590", fontSize: 10, flexShrink: 0 }}>▾</span>
      </button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setOpen(false)} />
          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100, background: "#fff", border: "1px solid #ECE7DE", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.1)", marginTop: 2 }}>
            {CORE_ROLES.map(role => (
              <label key={role} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid #F5F1EC" }}
                onClick={e => { e.preventDefault(); toggle(role) }}>
                <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${value.includes(role) ? "#E9532A" : "#ECE7DE"}`, background: value.includes(role) ? "#E9532A" : "#fff", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {value.includes(role) && <span style={{ color: "#fff", fontSize: 10, lineHeight: 1 }}>✓</span>}
                </div>
                <CoreRoleChip role={role} />
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function fmtDate(d: string): string {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  const [y, m, day] = d.split("-")
  if (day) return `${months[+m - 1]} ${+day}, ${y}`
  return `${months[+m - 1]} ${y}`
}

type AddMode = "none" | "internal" | "external" | "bulk"

const emptyForm = { name: "", role: "", coreRoles: [] as string[], description: "", annualSalary: "", billableHours: "", startDate: "", endDate: "" }

export default function PeoplePanel({ clientId, initialPeople, initialSalaryMonths, onPeopleChange, onSalaryMonthChange }: Props) {
  const fmt$ = useFmtCurrency()
  const [people, setPeople] = useState<Person[]>(initialPeople)
  const [salaryMonths, setSalaryMonths] = useState<PersonSalaryMonth[]>(initialSalaryMonths)
  const [addMode, setAddMode] = useState<AddMode>("none")
  const [addForm, setAddForm] = useState(emptyForm)
  const [addSaving, setAddSaving] = useState(false)
  const [editingPerson, setEditingPerson] = useState<Person | null>(null)
  const [editForm, setEditForm] = useState({ ...emptyForm, isExternal: false })
  const [editSaving, setEditSaving] = useState(false)

  const [bulkText, setBulkText] = useState("")
  const [bulkSaving, setBulkSaving] = useState(false)
  const bulkRows = useMemo(() => bulkText.trim() ? parseBulkText(bulkText) : [], [bulkText])
  const bulkValid = bulkRows.filter(r => !r.error)
  const bulkErrors = bulkRows.filter(r => r.error)

  const internal = people.filter(p => !p.isExternal)
  const external = people.filter(p => p.isExternal)

  function update(next: Person[]) { setPeople(next); onPeopleChange?.(next) }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAddSaving(true)
    const isExternal = addMode === "external"
    const res = await fetch(`/api/clients/${clientId}/people`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: addForm.name.trim(),
        role: addForm.role.trim() || null,
        responsibilities: isExternal
          ? (addForm.description.trim() || null)
          : stringifyCoreRoles(addForm.coreRoles),
        isExternal,
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
      setAddForm(emptyForm)
      setAddMode("none")
    }
  }

  function startEdit(p: Person) {
    setEditingPerson(p)
    setEditForm({
      name: p.name,
      role: p.role ?? "",
      coreRoles: p.isExternal ? [] : parseCoreRoles(p.responsibilities),
      description: p.isExternal ? (p.responsibilities ?? "") : "",
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
        responsibilities: editForm.isExternal
          ? (editForm.description.trim() || null)
          : stringifyCoreRoles(editForm.coreRoles),
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
      body: JSON.stringify(bulkValid.map(r => ({ name: r.name, role: r.role || undefined, annualSalary: r.annualSalary, billableHours: r.billableHours }))),
    })
    setBulkSaving(false)
    if (res.ok) {
      const created = await res.json()
      update([...people, ...created])
      setBulkText("")
      setAddMode("none")
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

  const internalHours = internal.reduce((s, p) => s + p.billableHours, 0)
  const internalSalaries = internal.reduce((s, p) => s + p.annualSalary, 0)
  const externalCosts = external.reduce((s, p) => s + p.annualSalary, 0)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Internal Team */}
      <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1A1916" }}>Internal Team</div>
            <div style={{ fontSize: 11, color: "#9C9590", marginTop: 2 }}>
              {internal.length === 0 ? "No team members yet" : `${internal.length} member${internal.length === 1 ? "" : "s"} · ${internalHours} billable hrs/mo`}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setAddMode(addMode === "bulk" ? "none" : "bulk")}
              style={{ padding: "6px 14px", background: "none", color: "#6B6760", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              Bulk import
            </button>
            <button onClick={() => { setAddMode("internal"); setAddForm(emptyForm) }}
              style={{ padding: "6px 14px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              + Add Member
            </button>
          </div>
        </div>

        {/* Bulk import */}
        {addMode === "bulk" && (
          <div style={{ background: "#FBFAF7", border: "1px solid #ECE7DE", borderRadius: 8, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "#6B6760", marginBottom: 8 }}>
              Paste rows — one per line: <span style={{ fontFamily: "monospace", background: "#ECE7DE", padding: "1px 5px", borderRadius: 3 }}>Name, Title, Annual Salary, Hours/mo</span>
            </div>
            <textarea autoFocus value={bulkText} onChange={e => setBulkText(e.target.value)}
              placeholder={"Jane Smith, Consultant, 75000, 50\nBob Jones, Strategist, 90000, 40"}
              style={{ ...inputStyle, background: "#fff", minHeight: 100, resize: "vertical", fontFamily: "monospace", fontSize: 12 }} />
            {bulkRows.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>{["Name","Title","Annual Salary","Hrs/mo",""].map(h => (
                      <th key={h} style={{ textAlign: "left", fontSize: 11, fontWeight: 600, color: "#9C9590", padding: "3px 6px", borderBottom: "1px solid #ECE7DE" }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {bulkRows.map((r, i) => (
                      <tr key={i} style={{ background: r.error ? "#FEF2F2" : "transparent" }}>
                        <td style={{ padding: "4px 6px", color: r.error ? "#C2410C" : "#1A1916" }}>{r.name || <span style={{ color: "#C2410C" }}>missing</span>}</td>
                        <td style={{ padding: "4px 6px", color: "#6B6760" }}>{r.role || "—"}</td>
                        <td style={{ padding: "4px 6px", color: "#6B6760" }}>{r.annualSalary ? fmt$(r.annualSalary) : "—"}</td>
                        <td style={{ padding: "4px 6px", color: "#6B6760" }}>{r.billableHours || "—"}</td>
                        <td style={{ padding: "4px 6px", color: "#C2410C", fontSize: 11 }}>{r.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center" }}>
                  <button onClick={handleBulkImport} disabled={bulkSaving || !bulkValid.length}
                    style={{ padding: "7px 16px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: bulkValid.length ? "pointer" : "not-allowed", opacity: bulkValid.length ? 1 : 0.5 }}>
                    {bulkSaving ? "Importing…" : `Import ${bulkValid.length} member${bulkValid.length === 1 ? "" : "s"}`}
                  </button>
                  {bulkErrors.length > 0 && <span style={{ fontSize: 11, color: "#C2410C" }}>{bulkErrors.length} row{bulkErrors.length > 1 ? "s" : ""} skipped</span>}
                  <button onClick={() => { setBulkText(""); setAddMode("none") }}
                    style={{ padding: "7px 10px", background: "none", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 12, cursor: "pointer", color: "#6B6760", marginLeft: "auto" }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {internal.length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Name", "Title", "Core Roles", "Annual Salary", "Billable hrs/mo", ""].map(h => (
                  <th key={h} style={{ textAlign: h === "Annual Salary" || h === "Billable hrs/mo" ? "right" : "left", fontSize: 11, fontWeight: 600, color: "#9C9590", padding: "4px 8px", borderBottom: "1px solid #ECE7DE" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {internal.map(p => {
                const status = personStatus(p)
                const hasDateInfo = p.startDate || p.endDate
                return (
                  <tr key={p.id}>
                    <td style={{ padding: "10px 8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, color: "#1A1916", fontWeight: 600 }}>{p.name}</span>
                        {hasDateInfo && <StatusBadge status={status} />}
                      </div>
                      {(p.startDate || p.endDate) && (
                        <div style={{ fontSize: 11, color: "#C0BAB2", marginTop: 2 }}>
                          {p.startDate ? fmtDate(p.startDate) : "?"} – {p.endDate ? fmtDate(p.endDate) : "present"}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "10px 8px", fontSize: 13, color: "#6B6760" }}>{p.role ?? <span style={{ color: "#C0BAB2" }}>—</span>}</td>
                    <td style={{ padding: "10px 8px" }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {parseCoreRoles(p.responsibilities).map(r => <CoreRoleChip key={r} role={r} />)}
                        {!p.responsibilities && <span style={{ color: "#C0BAB2", fontSize: 13 }}>—</span>}
                      </div>
                    </td>
                    <td style={{ padding: "10px 8px", fontSize: 13, color: "#1A1916", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{p.annualSalary ? fmt$(p.annualSalary) : <span style={{ color: "#C0BAB2" }}>—</span>}</td>
                    <td style={{ padding: "10px 8px", fontSize: 13, color: "#1A1916", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{p.billableHours} hrs</td>
                    <td style={{ padding: "10px 8px", textAlign: "right", whiteSpace: "nowrap" }}>
                      <button onClick={() => startEdit(p)} style={{ fontSize: 11, color: "#9C9590", background: "none", border: "1px solid #ECE7DE", borderRadius: 5, padding: "3px 10px", cursor: "pointer", marginRight: 6 }}>Edit</button>
                      <button onClick={() => handleDelete(p.id)} style={{ fontSize: 11, color: "#C2410C", background: "none", border: "1px solid #FCA5A5", borderRadius: 5, padding: "3px 10px", cursor: "pointer" }}>Remove</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : addMode !== "bulk" && (
          <div style={{ fontSize: 13, color: "#9C9590", padding: "12px 0" }}>
            Add the people doing delivery work — yourself included — with how many hours per month each can commit to clients.
          </div>
        )}

        {internal.length > 0 && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #ECE7DE", display: "flex", gap: 24 }}>
            <div>
              <div style={{ fontSize: 11, color: "#9C9590", marginBottom: 2 }}>Total capacity</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#1A1916", fontVariantNumeric: "tabular-nums" }}>{internalHours} hrs/mo</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#9C9590", marginBottom: 2 }}>Team size</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#1A1916" }}>{internal.length}</div>
            </div>
            {internalSalaries > 0 && (
              <div>
                <div style={{ fontSize: 11, color: "#9C9590", marginBottom: 2 }}>Total annual salaries</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#1A1916", fontVariantNumeric: "tabular-nums" }}>{fmt$(internalSalaries)}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* External Vendors */}
      <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1A1916" }}>External Vendors</div>
            <div style={{ fontSize: 11, color: "#9C9590", marginTop: 2 }}>
              {external.length === 0
                ? "Coaches, contractors, and other external costs"
                : `${external.length} vendor${external.length === 1 ? "" : "s"}${externalCosts > 0 ? " · " + fmt$(externalCosts) + "/yr total cost" : ""}`}
            </div>
            <div style={{ fontSize: 11, color: "#9C9590", marginTop: 4, fontStyle: "italic" }}>
              These costs factor into your SDE when selling the business.
            </div>
          </div>
          <button onClick={() => { setAddMode("external"); setAddForm(emptyForm) }}
            style={{ padding: "6px 14px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
            + Add Vendor
          </button>
        </div>

        {external.length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Name", "Role", "Description", "Annual Cost", ""].map(h => (
                  <th key={h} style={{ textAlign: h === "Annual Cost" ? "right" : "left", fontSize: 11, fontWeight: 600, color: "#9C9590", padding: "4px 8px", borderBottom: "1px solid #ECE7DE" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {external.map(p => {
                const status = personStatus(p)
                const hasDateInfo = p.startDate || p.endDate
                return (
                  <tr key={p.id}>
                    <td style={{ padding: "10px 8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, color: "#1A1916", fontWeight: 600 }}>{p.name}</span>
                        {hasDateInfo && <StatusBadge status={status} />}
                      </div>
                      {(p.startDate || p.endDate) && (
                        <div style={{ fontSize: 11, color: "#C0BAB2", marginTop: 2 }}>
                          {p.startDate ? fmtDate(p.startDate) : "?"} – {p.endDate ? fmtDate(p.endDate) : "present"}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "10px 8px", fontSize: 13, color: "#6B6760" }}>{p.role ?? <span style={{ color: "#C0BAB2" }}>—</span>}</td>
                    <td style={{ padding: "10px 8px", fontSize: 13, color: "#6B6760", maxWidth: 280 }}>
                      {p.responsibilities
                        ? <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.responsibilities}</span>
                        : <span style={{ color: "#C0BAB2" }}>—</span>}
                    </td>
                    <td style={{ padding: "10px 8px", fontSize: 13, color: "#1A1916", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{p.annualSalary ? fmt$(p.annualSalary) + "/yr" : <span style={{ color: "#C0BAB2" }}>—</span>}</td>
                    <td style={{ padding: "10px 8px", textAlign: "right", whiteSpace: "nowrap" }}>
                      <button onClick={() => startEdit(p)} style={{ fontSize: 11, color: "#9C9590", background: "none", border: "1px solid #ECE7DE", borderRadius: 5, padding: "3px 10px", cursor: "pointer", marginRight: 6 }}>Edit</button>
                      <button onClick={() => handleDelete(p.id)} style={{ fontSize: 11, color: "#C2410C", background: "none", border: "1px solid #FCA5A5", borderRadius: 5, padding: "3px 10px", cursor: "pointer" }}>Remove</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div style={{ fontSize: 13, color: "#9C9590", padding: "12px 0" }}>
            Add coaches, fractional hires, and recurring contractors whose costs a buyer would need to replace.
          </div>
        )}
      </div>

      {/* Monthly Salary Table */}
      {people.length > 0 && (
        <PersonSalaryTable
          people={people}
          salaryMonths={salaryMonths}
          clientId={clientId}
          onSalaryMonthChange={handleSalaryMonthUpdate}
        />
      )}

      {/* Add Person Modal */}
      {(addMode === "internal" || addMode === "external") && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={e => { if (e.target === e.currentTarget) { setAddMode("none"); setAddForm(emptyForm) } }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 28, width: 500, boxShadow: "0 8px 32px rgba(0,0,0,0.18)", maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 22, fontWeight: 600, margin: "0 0 20px", color: "#1A1916" }}>
              {addMode === "internal" ? "Add Team Member" : "Add External Vendor"}
            </h3>
            <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Name</label>
                  <input style={inputStyle} value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} required placeholder={addMode === "external" ? "Philip McKernan" : "Jane Smith"} autoFocus />
                </div>
                <div>
                  <label style={labelStyle}>Role / Title <span style={{ fontWeight: 400 }}>(optional)</span></label>
                  <input style={inputStyle} value={addForm.role} onChange={e => setAddForm(f => ({ ...f, role: e.target.value }))} placeholder={addMode === "external" ? "Business Coach" : "CEO"} />
                </div>
              </div>
              {addMode === "internal" ? (
                <div>
                  <label style={labelStyle}>Core Roles</label>
                  <CoreRolePicker value={addForm.coreRoles} onChange={v => setAddForm(f => ({ ...f, coreRoles: v }))} />
                </div>
              ) : (
                <div>
                  <label style={labelStyle}>Description <span style={{ fontWeight: 400 }}>(what they do / why they're relevant)</span></label>
                  <textarea style={{ ...inputStyle, minHeight: 72, resize: "vertical" }} value={addForm.description} onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))} placeholder="Executive coaching, strategic advisory…" />
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>{addMode === "internal" ? "Annual Salary" : "Annual Cost"}</label>
                  <input style={inputStyle} type="number" min={0} step={1} value={addForm.annualSalary} onChange={e => setAddForm(f => ({ ...f, annualSalary: e.target.value }))} placeholder="60000" />
                </div>
                {addMode === "internal" && (
                  <div>
                    <label style={labelStyle}>Billable hrs/mo</label>
                    <input style={inputStyle} type="number" min={0} step={1} value={addForm.billableHours} onChange={e => setAddForm(f => ({ ...f, billableHours: e.target.value }))} placeholder="50" />
                  </div>
                )}
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
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                <button type="button" onClick={() => { setAddMode("none"); setAddForm(emptyForm) }}
                  style={{ padding: "8px 16px", background: "none", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 13, cursor: "pointer", color: "#6B6760" }}>
                  Cancel
                </button>
                <button type="submit" disabled={addSaving}
                  style={{ padding: "8px 20px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  {addSaving ? "Saving…" : addMode === "internal" ? "Add Member" : "Add Vendor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingPerson && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={e => { if (e.target === e.currentTarget) setEditingPerson(null) }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 28, width: 500, boxShadow: "0 8px 32px rgba(0,0,0,0.18)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h3 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 22, fontWeight: 600, margin: 0, color: "#1A1916" }}>
                Edit {editForm.isExternal ? "Vendor" : "Team Member"}
              </h3>
              <select value={editForm.isExternal ? "external" : "internal"}
                onChange={e => setEditForm(f => ({ ...f, isExternal: e.target.value === "external" }))}
                style={{ fontSize: 12, border: "1px solid #ECE7DE", borderRadius: 6, padding: "4px 8px", background: "#fff", color: "#6B6760", cursor: "pointer", outline: "none" }}>
                <option value="internal">Internal Team</option>
                <option value="external">External Vendor</option>
              </select>
            </div>
            <form onSubmit={handleEditSave} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Name</label>
                  <input style={inputStyle} value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} required autoFocus />
                </div>
                <div>
                  <label style={labelStyle}>Role / Title <span style={{ fontWeight: 400 }}>(optional)</span></label>
                  <input style={inputStyle} value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))} placeholder={editForm.isExternal ? "Business Coach" : "CEO"} />
                </div>
              </div>
              {editForm.isExternal ? (
                <div>
                  <label style={labelStyle}>Description</label>
                  <textarea style={{ ...inputStyle, minHeight: 72, resize: "vertical" }} value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} placeholder="What they do / why they're relevant…" />
                </div>
              ) : (
                <div>
                  <label style={labelStyle}>Core Roles</label>
                  <CoreRolePicker value={editForm.coreRoles} onChange={v => setEditForm(f => ({ ...f, coreRoles: v }))} />
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>{editForm.isExternal ? "Annual Cost" : "Annual Salary"}</label>
                  <input style={inputStyle} type="number" min={0} step={1} value={editForm.annualSalary} onChange={e => setEditForm(f => ({ ...f, annualSalary: e.target.value }))} placeholder="60000" />
                </div>
                {!editForm.isExternal && (
                  <div>
                    <label style={labelStyle}>Billable hrs/mo</label>
                    <input style={inputStyle} type="number" min={0} step={1} value={editForm.billableHours} onChange={e => setEditForm(f => ({ ...f, billableHours: e.target.value }))} placeholder="50" />
                  </div>
                )}
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

// ── Helpers ────────────────────────────────────────────────────────────────────

interface BulkRow { name: string; role: string; annualSalary: number; billableHours: number; error?: string }

function parseBulkText(text: string): BulkRow[] {
  return text.split("\n").map(l => l.trim()).filter(Boolean).map(line => {
    const parts = line.split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(p => p.trim().replace(/^"|"$/g, ""))
    const name = parts[0] ?? ""
    const role = parts[1] ?? ""
    const annualSalary = parseFloat((parts[2] ?? "").replace(/[$£€,]/g, "")) || 0
    const billableHours = parseFloat(parts[3] ?? "") || 0
    return { name, role, annualSalary, billableHours, error: !name ? "Name required" : undefined }
  })
}

function ymNext(ym: string): string {
  const [y, m] = ym.split("-").map(Number)
  const total = y * 12 + (m - 1) + 1
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`
}

function genMonthsRange(from: string, to: string): string[] {
  const months: string[] = []
  let cur = from
  while (cur <= to) { months.push(cur); cur = ymNext(cur) }
  return months
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
  const fmt$ = useFmtCurrency()
  const nowYM = new Date().toISOString().slice(0, 7)
  const scrollRef = useRef<HTMLDivElement>(null)

  const toYM = (d: string | null) => d ? d.slice(0, 7) : null
  const startYMs = people.map(p => toYM(p.startDate)).filter(Boolean) as string[]
  const endYMs = people.map(p => toYM(p.endDate)).filter(Boolean) as string[]
  const tableStart = startYMs.length > 0 ? startYMs.reduce((a, b) => a < b ? a : b) : nowYM
  const tableEnd = [nowYM, ...endYMs].reduce((a, b) => a > b ? a : b)
  const months = genMonthsRange(tableStart, tableEnd)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
  }, [tableStart, tableEnd])

  const salaryMap = new Map<string, number>()
  salaryMonths.forEach(sm => salaryMap.set(`${sm.personId}:${sm.month}`, sm.monthlySalary))

  const [editingCell, setEditingCell] = useState<{ personId: string; month: string } | null>(null)
  const [editValue, setEditValue] = useState("")
  const [saving, setSaving] = useState(false)

  function baseMonthlySalary(p: Person) { return p.annualSalary > 0 ? Math.round(p.annualSalary / 12) : 0 }

  function isActive(p: Person, mo: string) {
    const start = toYM(p.startDate)
    const end = toYM(p.endDate)
    if (start && mo < start) return false
    if (end && mo > end) return false
    return true
  }

  function cellValue(personId: string, month: string, p: Person) {
    const override = salaryMap.get(`${personId}:${month}`)
    return { value: override ?? baseMonthlySalary(p), isOverride: override !== undefined }
  }

  async function saveCell(personId: string, month: string) {
    const raw = editValue.replace(/[$£€,\s]/g, "")
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
    <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1916", marginBottom: 4 }}>Monthly Salary</div>
      <div style={{ fontSize: 11, color: "#9C9590", marginBottom: 14 }}>
        Grey values derive from annual salary ÷ 12. Click a cell to set an override — e.g. after a raise taking effect next month.
      </div>
      <div ref={scrollRef} style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", fontSize: 11, fontWeight: 600, color: "#9C9590", padding: "4px 16px 4px 0", borderBottom: "1px solid #ECE7DE", minWidth: 140, whiteSpace: "nowrap", position: "sticky", left: 0, background: "#fff", zIndex: 1 }}>
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
                <td style={{ padding: "8px 16px 8px 0", fontSize: 13, fontWeight: 500, color: "#1A1916", borderBottom: "1px solid #F5F1EC", whiteSpace: "nowrap", position: "sticky", left: 0, background: "#fff", zIndex: 1 }}>
                  <div>{p.name}</div>
                  {p.isExternal && <div style={{ fontSize: 10, color: "#9C9590", marginTop: 1 }}>Vendor</div>}
                </td>
                {months.map(mo => {
                  const active = isActive(p, mo)
                  const { value, isOverride } = cellValue(p.id, mo, p)
                  const isEditing = editingCell?.personId === p.id && editingCell.month === mo
                  return (
                    <td key={mo} style={{ padding: "4px 4px", textAlign: "right", borderBottom: "1px solid #F5F1EC", minWidth: 86, background: active ? undefined : "#FAFAF8" }}>
                      {active && isEditing ? (
                        <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)}
                          onBlur={() => saveCell(p.id, mo)}
                          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); saveCell(p.id, mo) } if (e.key === "Escape") setEditingCell(null) }}
                          disabled={saving}
                          style={{ width: 78, textAlign: "right", fontSize: 12, border: "1px solid #E9532A", borderRadius: 4, padding: "3px 6px", outline: "none", fontFamily: "inherit", fontVariantNumeric: "tabular-nums" }} />
                      ) : (
                        <button type="button" onClick={() => active && openCell(p.id, mo, value)}
                          style={{ background: "none", border: "none", cursor: active ? "pointer" : "default", padding: "3px 8px", fontSize: 12, fontVariantNumeric: "tabular-nums", borderRadius: 4, color: !active ? "#ECE7DE" : isOverride ? "#1A1916" : "#C0BAB2", fontWeight: isOverride ? 600 : 400, width: "100%", textAlign: "right" }}>
                          {active && value > 0 ? fmt$(value) : "—"}
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
