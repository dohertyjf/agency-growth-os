"use client"
import { useState, useMemo, useRef, useEffect } from "react"
import { useFmtCurrency, useCurrency } from "@/lib/CurrencyContext"

const PEOPLE_STYLES = `
  .pm-cards { display: none; }
  .pm-bulk-btn { display: inline-block; }
  @media (max-width: 639px) {
    .pm-cards { display: block; }
    .pm-table-wrap { display: none; }
    .pm-bulk-btn { display: none; }
  }
`

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
  isFullTime: boolean
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

interface PersonHoursMonth {
  personId: string
  month: string
  monthlyHours: number
}

interface Contract {
  status: string
  monthly: number
  hoursPerMonth: number
}

interface Goal {
  peoplePct?: number | null
  closeRatePct?: number
}

interface Metric { month: string; closeRate: number; leads: number; newClients: number }

interface Props {
  clientId: string
  initialPeople: Person[]
  initialSalaryMonths: PersonSalaryMonth[]
  initialHoursMonths?: PersonHoursMonth[]
  contracts?: Contract[]
  goal?: Goal | null
  metrics?: Metric[]
  onPeopleChange?: (people: Person[]) => void
  onSalaryMonthChange?: (sm: PersonSalaryMonth) => void
  onHoursMonthChange?: (hm: PersonHoursMonth) => void
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

const emptyForm = { name: "", role: "", coreRoles: [] as string[], description: "", annualSalary: "", billableHours: "", startDate: "", endDate: "", isFullTime: true }

export default function PeoplePanel({ clientId, initialPeople, initialSalaryMonths, initialHoursMonths = [], contracts = [], goal, metrics = [], onPeopleChange, onSalaryMonthChange, onHoursMonthChange }: Props) {
  const fmt$ = useFmtCurrency()
  const [people, setPeople] = useState<Person[]>(initialPeople)
  const [salaryMonths, setSalaryMonths] = useState<PersonSalaryMonth[]>(initialSalaryMonths)
  const [hoursMonths, setHoursMonths] = useState<PersonHoursMonth[]>(initialHoursMonths)
  const [addMode, setAddMode] = useState<AddMode>("none")
  const [addForm, setAddForm] = useState(emptyForm)
  const [addSaving, setAddSaving] = useState(false)
  const [editingPerson, setEditingPerson] = useState<Person | null>(null)
  const [editForm, setEditForm] = useState({ ...emptyForm, isExternal: false, isFullTime: true })
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
        isFullTime: isExternal ? true : addForm.isFullTime,
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
      isFullTime: p.isFullTime,
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
        isFullTime: editForm.isExternal ? true : editForm.isFullTime,
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
      return idx >= 0 ? prev.map((s, i) => i === idx ? sm : s) : [...prev, sm]
    })
    onSalaryMonthChange?.(sm)
  }

  function handleHoursMonthUpdate(hm: PersonHoursMonth) {
    setHoursMonths(prev => {
      const idx = prev.findIndex(h => h.personId === hm.personId && h.month === hm.month)
      return idx >= 0 ? prev.map((h, i) => i === idx ? hm : h) : [...prev, hm]
    })
    onHoursMonthChange?.(hm)
  }

  const internalHours = internal.reduce((s, p) => s + p.billableHours, 0)
  const internalSalaries = internal.reduce((s, p) => s + p.annualSalary, 0)
  const externalCosts = external.reduce((s, p) => s + p.annualSalary, 0)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <style>{PEOPLE_STYLES}</style>

      {/* Internal Team */}
      <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1A1916" }}>Internal Team</div>
            <div style={{ fontSize: 11, color: "#9C9590", marginTop: 2 }}>
              {internal.length === 0 ? "No team members yet" : `${internal.length} member${internal.length === 1 ? "" : "s"} · ${internalHours} billable hrs/mo`}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button className="pm-bulk-btn" onClick={() => setAddMode(addMode === "bulk" ? "none" : "bulk")}
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
          <>
            {/* Mobile card view */}
            <div className="pm-cards">
              {internal.map(p => {
                const status = personStatus(p)
                const hasDateInfo = p.startDate || p.endDate
                const roles = parseCoreRoles(p.responsibilities)
                return (
                  <div key={p.id} style={{ padding: "12px 0", borderBottom: "1px solid #F5F1EC" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#1A1916" }}>{p.name}</span>
                          {hasDateInfo && <StatusBadge status={status} />}
                        </div>
                        {p.role && <div style={{ fontSize: 12, color: "#6B6760", marginTop: 2 }}>{p.role}</div>}
                        {(p.startDate || p.endDate) && (
                          <div style={{ fontSize: 11, color: "#C0BAB2", marginTop: 2 }}>
                            {p.startDate ? fmtDate(p.startDate) : "?"} – {p.endDate ? fmtDate(p.endDate) : "present"}
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button onClick={() => startEdit(p)} style={{ fontSize: 11, color: "#9C9590", background: "none", border: "1px solid #ECE7DE", borderRadius: 5, padding: "4px 10px", cursor: "pointer" }}>Edit</button>
                        <button onClick={() => handleDelete(p.id)} style={{ fontSize: 11, color: "#C2410C", background: "none", border: "1px solid #FCA5A5", borderRadius: 5, padding: "4px 10px", cursor: "pointer" }}>✕</button>
                      </div>
                    </div>
                    {roles.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                        {roles.map(r => <CoreRoleChip key={r} role={r} />)}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 12, color: "#6B6760", fontVariantNumeric: "tabular-nums" }}>
                      {p.annualSalary > 0 && <span><strong style={{ color: "#1A1916" }}>{fmt$(p.annualSalary)}</strong>/yr</span>}
                      {p.billableHours > 0 && <span>{p.billableHours} hrs/mo</span>}
                    </div>
                  </div>
                )
              })}
            </div>
            {/* Desktop table view */}
            <div className="pm-table-wrap">
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
            </div>
          </>
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
          <>
            {/* Mobile card view */}
            <div className="pm-cards">
              {external.map(p => {
                const status = personStatus(p)
                const hasDateInfo = p.startDate || p.endDate
                return (
                  <div key={p.id} style={{ padding: "12px 0", borderBottom: "1px solid #F5F1EC" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#1A1916" }}>{p.name}</span>
                          {hasDateInfo && <StatusBadge status={status} />}
                        </div>
                        {p.role && <div style={{ fontSize: 12, color: "#6B6760", marginTop: 2 }}>{p.role}</div>}
                        {(p.startDate || p.endDate) && (
                          <div style={{ fontSize: 11, color: "#C0BAB2", marginTop: 2 }}>
                            {p.startDate ? fmtDate(p.startDate) : "?"} – {p.endDate ? fmtDate(p.endDate) : "present"}
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button onClick={() => startEdit(p)} style={{ fontSize: 11, color: "#9C9590", background: "none", border: "1px solid #ECE7DE", borderRadius: 5, padding: "4px 10px", cursor: "pointer" }}>Edit</button>
                        <button onClick={() => handleDelete(p.id)} style={{ fontSize: 11, color: "#C2410C", background: "none", border: "1px solid #FCA5A5", borderRadius: 5, padding: "4px 10px", cursor: "pointer" }}>✕</button>
                      </div>
                    </div>
                    {p.responsibilities && (
                      <div style={{ fontSize: 12, color: "#6B6760", marginTop: 6 }}>{p.responsibilities}</div>
                    )}
                    {p.annualSalary > 0 && (
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#1A1916", marginTop: 6, fontVariantNumeric: "tabular-nums" }}>{fmt$(p.annualSalary)}/yr</div>
                    )}
                  </div>
                )
              })}
            </div>
            {/* Desktop table view */}
            <div className="pm-table-wrap">
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
            </div>
          </>
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
          hoursMonths={hoursMonths}
          clientId={clientId}
          onSalaryMonthChange={handleSalaryMonthUpdate}
          onHoursMonthChange={handleHoursMonthUpdate}
        />
      )}

      {/* Hire Modeler */}
      <HireModeler people={people} contracts={contracts} goal={goal ?? null} metrics={metrics} />

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
              {addMode === "internal" && (
                <div>
                  <label style={labelStyle}>Employment Type</label>
                  <div style={{ display: "flex", gap: 0, border: "1px solid #ECE7DE", borderRadius: 6, overflow: "hidden" }}>
                    {[{ value: true, label: "Full Time" }, { value: false, label: "Part Time / Contractor" }].map(opt => (
                      <button key={String(opt.value)} type="button"
                        onClick={() => setAddForm(f => ({ ...f, isFullTime: opt.value, billableHours: opt.value ? "128" : "" }))}
                        style={{ flex: 1, padding: "7px 10px", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", background: addForm.isFullTime === opt.value ? "#E9532A" : "#fff", color: addForm.isFullTime === opt.value ? "#fff" : "#6B6760", borderRight: opt.value ? "1px solid #ECE7DE" : "none" }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>{addMode === "internal" ? "Annual Salary" : "Annual Cost"}</label>
                  <input style={inputStyle} type="number" min={0} step={1} value={addForm.annualSalary} onChange={e => setAddForm(f => ({ ...f, annualSalary: e.target.value }))} placeholder="60000" />
                </div>
                {addMode === "internal" && (
                  <div>
                    <label style={labelStyle}>{addForm.isFullTime ? "Billable hrs/mo" : "Monthly hrs"}</label>
                    <input style={inputStyle} type="number" min={0} step={1} value={addForm.billableHours}
                      onChange={e => setAddForm(f => ({ ...f, billableHours: e.target.value }))}
                      placeholder={addForm.isFullTime ? "128" : "80"} />
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
              {!editForm.isExternal && (
                <div>
                  <label style={labelStyle}>Employment Type</label>
                  <div style={{ display: "flex", gap: 0, border: "1px solid #ECE7DE", borderRadius: 6, overflow: "hidden" }}>
                    {[{ value: true, label: "Full Time" }, { value: false, label: "Part Time / Contractor" }].map(opt => (
                      <button key={String(opt.value)} type="button"
                        onClick={() => setEditForm(f => ({ ...f, isFullTime: opt.value, billableHours: opt.value && (!f.billableHours || parseFloat(f.billableHours) === 0) ? "128" : f.billableHours }))}
                        style={{ flex: 1, padding: "7px 10px", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", background: editForm.isFullTime === opt.value ? "#E9532A" : "#fff", color: editForm.isFullTime === opt.value ? "#fff" : "#6B6760", borderRight: opt.value ? "1px solid #ECE7DE" : "none" }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>{editForm.isExternal ? "Annual Cost" : "Annual Salary"}</label>
                  <input style={inputStyle} type="number" min={0} step={1} value={editForm.annualSalary} onChange={e => setEditForm(f => ({ ...f, annualSalary: e.target.value }))} placeholder="60000" />
                </div>
                {!editForm.isExternal && (
                  <div>
                    <label style={labelStyle}>{editForm.isFullTime ? "Billable hrs/mo" : "Monthly hrs"}</label>
                    <input style={inputStyle} type="number" min={0} step={1} value={editForm.billableHours}
                      onChange={e => setEditForm(f => ({ ...f, billableHours: e.target.value }))}
                      placeholder={editForm.isFullTime ? "128" : "80"} />
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

// ── Hire Modeler ───────────────────────────────────────────────────────────────

function currSym(c: string) { return c === "GBP" ? "£" : c === "EUR" ? "€" : "$" }

function addMonthsYM(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number)
  const total = y * 12 + (m - 1) + n
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`
}

function HireModeler({ people, contracts, goal, metrics }: { people: Person[]; contracts: Contract[]; goal: Goal | null; metrics: Metric[] }) {
  const fmt$ = useFmtCurrency()
  const sym = currSym(useCurrency())

  const [annualCost, setAnnualCost] = useState("")
  const [billableHrs, setBillableHrs] = useState("")
  const [growthPct, setGrowthPct] = useState(0)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const nowYM = new Date().toISOString().slice(0, 7)
  const nowDate = new Date().toISOString().slice(0, 10)

  // Baseline
  const activeMRR = contracts.filter(c => c.status === "active").reduce((s, c) => s + c.monthly, 0)
  const pipelineMRR = contracts.filter(c => c.status === "opportunity" || c.status === "potential").reduce((s, c) => s + c.monthly, 0)
  const contractedHours = contracts.filter(c => c.status === "active").reduce((s, c) => s + c.hoursPerMonth, 0)
  const pipelineHours = contracts.filter(c => c.status === "opportunity" || c.status === "potential").reduce((s, c) => s + c.hoursPerMonth, 0)
  const activeClientCount = contracts.filter(c => c.status === "active").length
  // Trailing 3-month close rate (%), falling back to the goal target, then 30.
  const recentClose = metrics.filter(m => m.closeRate > 0).sort((a, b) => a.month.localeCompare(b.month)).slice(-3)
  const closeRatePct = recentClose.length ? Math.round(recentClose.reduce((s, m) => s + m.closeRate, 0) / recentClose.length) : (goal?.closeRatePct ?? 30)
  const closeLabel = recentClose.length ? "trailing 3mo" : "target"
  const peoplePctTarget = goal?.peoplePct ?? 40
  const expectedNewMRR = pipelineMRR * (closeRatePct / 100)

  const activePeople = people.filter(p => {
    if (p.startDate && p.startDate > nowDate) return false
    if (p.endDate && p.endDate < nowDate) return false
    return true
  })
  const totalCapacity = activePeople.filter(p => !p.isExternal).reduce((s, p) => s + p.billableHours, 0)
  const currentMonthlyPayroll = activePeople.reduce((s, p) => s + p.annualSalary / 12, 0)

  const hireMonthlyCost = parseFloat(annualCost) > 0 ? parseFloat(annualCost) / 12 : 0
  const hireBillableHrs = parseFloat(billableHrs) > 0 ? parseFloat(billableHrs) : 0
  const hasHireInputs = hireMonthlyCost > 0 || hireBillableHrs > 0

  const CAPACITY_THRESHOLD = 75
  const scaledExpectedNewMRR = expectedNewMRR * (1 + growthPct / 100)
  // Demand is measured in HOURS: pipeline projects' hours, weighted by close rate (expected)
  // or unweighted (potential), scaled by the growth scenario.
  const expectedNewHoursBase = pipelineHours * (closeRatePct / 100)
  const expectedNewHours = expectedNewHoursBase * (1 + growthPct / 100)
  const potentialNewHours = pipelineHours * (1 + growthPct / 100)

  // 12-month projection
  const projMonths = Array.from({ length: 12 }, (_, i) => addMonthsYM(nowYM, i + 1))
  const monthLabels = projMonths.map(fmtYM)

  const monthData = projMonths.map((_, i) => {
    const ramp = Math.min((i + 1) / 6, 1)
    // Hours needed = current contracted hours + pipeline hours (weighted / full), ramping in.
    const demandHours = contractedHours + expectedNewHours * ramp
    const capUtil = totalCapacity > 0 ? (demandHours / totalCapacity) * 100 : 0
    const potentialDemandHours = contractedHours + potentialNewHours * ramp
    const potentialCapUtil = totalCapacity > 0 ? (potentialDemandHours / totalCapacity) * 100 : 0
    // Revenue is only used for the budget gate (people-cost %).
    const revenue = activeMRR + scaledExpectedNewMRR * ramp
    const peoplePct = revenue > 0 ? ((currentMonthlyPayroll + hireMonthlyCost) / revenue) * 100 : 100
    const capacityGate = totalCapacity > 0 && contractedHours > 0 && capUtil >= CAPACITY_THRESHOLD
    const budgetGate = revenue > 0 && peoplePct <= peoplePctTarget
    return { revenue, demandHours, potentialDemandHours, capUtil, potentialCapUtil, peoplePct, capacityGate, budgetGate }
  })

  const currentCapUtil = totalCapacity > 0 && contractedHours > 0 ? (contractedHours / totalCapacity) * 100 : 0
  const currentPeoplePct = activeMRR > 0 ? (currentMonthlyPayroll / activeMRR) * 100 : 0

  const capacityGateMonth = monthData.findIndex(d => d.capacityGate)
  const budgetGateMonth = hasHireInputs ? monthData.findIndex(d => d.budgetGate) : -1
  const bothGatesMonth = hasHireInputs ? monthData.findIndex(d => d.capacityGate && d.budgetGate) : -1

  const revenueGap = hasHireInputs && capacityGateMonth >= 0 && !monthData[capacityGateMonth].budgetGate && (peoplePctTarget ?? 0) > 0
    ? Math.max(0, (currentMonthlyPayroll + hireMonthlyCost) / (peoplePctTarget / 100) - monthData[capacityGateMonth].revenue)
    : 0

  // Chart
  const W = 880, H = 200, PL = 52, PR = 24, PT = 24, PB = 28
  const plotW = W - PL - PR
  const plotH = H - PT - PB
  const peakUtil = Math.max(120, ...monthData.map(d => Math.max(d.capUtil, d.potentialCapUtil, hasHireInputs ? d.peoplePct : 0)))
  const YMAX = Math.ceil(peakUtil / 25) * 25
  const toX = (i: number) => PL + (i / 11) * plotW
  const toY = (pct: number) => PT + plotH - Math.min(pct, YMAX) / YMAX * plotH
  const slotW = plotW / 11

  function handleSvgMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const svgX = ((e.clientX - rect.left) / rect.width) * W
    setHoverIdx(Math.max(0, Math.min(11, Math.round((svgX - PL) / (plotW / 11)))))
  }

  function regionBand(a: number, b: number) {
    const x = a === 0 ? PL : toX(a) - slotW / 2
    const x2 = b === 11 ? W - PR : toX(b) + slotW / 2
    return { x, width: x2 - x }
  }

  function getRegions(pred: (d: typeof monthData[0]) => boolean) {
    const regions: { x: number; width: number }[] = []
    let start = -1
    monthData.forEach((d, i) => {
      if (pred(d)) { if (start < 0) start = i }
      else { if (start >= 0) { regions.push(regionBand(start, i - 1)); start = -1 } }
    })
    if (start >= 0) regions.push(regionBand(start, 11))
    return regions
  }

  const hireRegions = hasHireInputs ? getRegions(d => d.capacityGate && d.budgetGate) : []
  const gapRegions = hasHireInputs ? getRegions(d => d.capacityGate && !d.budgetGate) : []
  const capLine = monthData.map((d, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(d.capUtil)}`).join(" ")
  const potentialLine = totalCapacity > 0 && contractedHours > 0 && pipelineHours > 0
    ? monthData.map((d, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(d.potentialCapUtil)}`).join(" ")
    : null
  const peopleLine = hasHireInputs && activeMRR > 0
    ? monthData.map((d, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(d.peoplePct)}`).join(" ")
    : null

  const scenarioNote = growthPct > 0 ? ` (${growthPct}% growth scenario)` : ""

  type MsgType = "good" | "warning" | "info" | "neutral"
  const msg: { type: MsgType; text: string; sub?: string } | null = hasHireInputs ? (() => {
    if (bothGatesMonth >= 0) {
      const capFirst = capacityGateMonth <= budgetGateMonth
      const same = capacityGateMonth === budgetGateMonth
      if (capFirst) {
        return {
          type: "good" as const,
          text: same
            ? `Both gates open in ${monthLabels[bothGatesMonth]}${scenarioNote} — capacity reaches ${CAPACITY_THRESHOLD}% and the budget supports this hire at the same time.`
            : `Capacity reaches ${CAPACITY_THRESHOLD}% in ${monthLabels[capacityGateMonth]}. Budget supports the hire from ${monthLabels[budgetGateMonth]}. Hiring window opens ${monthLabels[bothGatesMonth]}${scenarioNote}.`,
        }
      }
      return {
        type: "info" as const,
        text: `Budget supports this hire from ${monthLabels[budgetGateMonth]}${scenarioNote}, but capacity doesn't reach ${CAPACITY_THRESHOLD}% until ${monthLabels[capacityGateMonth]}. Consider waiting until ${monthLabels[bothGatesMonth]} when the work actually demands it.`,
      }
    }
    if (capacityGateMonth >= 0 && budgetGateMonth < 0) {
      return {
        type: "warning" as const,
        text: `You'll need more capacity from ${monthLabels[capacityGateMonth]}${scenarioNote}, but this hire pushes people costs to ${Math.round(monthData[capacityGateMonth].peoplePct)}% — above your ${peoplePctTarget}% target.${revenueGap > 0 ? ` You need ${fmt$(Math.round(revenueGap))}/mo more revenue for the budget gate to open.` : ""}`,
        sub: revenueGap > 0 && activeClientCount > 0
          ? `Raise existing client rates by ${fmt$(Math.round(revenueGap / activeClientCount))}/mo each — or reduce delivery hours per client, which lets you serve more clients from existing capacity and grows revenue without adding cost.`
          : "Raise rates with existing clients, or reduce delivery hours per client to serve more clients from existing capacity.",
      }
    }
    if (budgetGateMonth >= 0 && capacityGateMonth < 0) {
      return {
        type: "info" as const,
        text: `Budget supports this hire from ${monthLabels[budgetGateMonth]}${scenarioNote}, but capacity stays below ${CAPACITY_THRESHOLD}% for the next 12 months — no urgent need at current volumes.`,
      }
    }
    return {
      type: "neutral" as const,
      text: `Neither gate opens in the next 12 months${scenarioNote ? " even " + scenarioNote : " at this trajectory"}. Fill more pipeline before adding headcount.`,
    }
  })() : null

  return (
    <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 20 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#1A1916" }}>Hire Modeler</div>
        <div style={{ fontSize: 11, color: "#9C9590", marginTop: 2 }}>
          Model a prospective hire to see when capacity need and budget align.
          Both gates must be open — you need the work and can afford the cost.
        </div>
      </div>

      {/* Current state */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        {[
          {
            label: "Capacity used now",
            value: totalCapacity > 0 && contractedHours > 0 ? `${Math.round(currentCapUtil)}%` : "—",
            sub: totalCapacity > 0 ? `${contractedHours} / ${totalCapacity} hrs` : "No team hours set",
            alert: currentCapUtil >= 90 ? "red" : currentCapUtil >= CAPACITY_THRESHOLD ? "amber" : "",
          },
          {
            label: "People % of revenue",
            value: activeMRR > 0 ? `${Math.round(currentPeoplePct)}%` : "—",
            sub: `Target: ${peoplePctTarget}%`,
            alert: activeMRR > 0 && currentPeoplePct > peoplePctTarget ? "red" : "",
          },
          {
            label: "Pipeline demand (expected)",
            value: pipelineHours > 0 ? `+${Math.round(expectedNewHoursBase)} hrs/mo` : "—",
            sub: pipelineHours > 0 ? `${Math.round(pipelineHours)} pipeline hrs × ${closeRatePct}% close (${closeLabel})` : "No hours on pipeline projects",
            alert: "",
          },
        ].map(stat => (
          <div key={stat.label} style={{ background: "#FBFAF7", border: "1px solid #ECE7DE", borderRadius: 8, padding: "10px 14px", minWidth: 160, flex: 1 }}>
            <div style={{ fontSize: 11, color: "#9C9590", marginBottom: 4 }}>{stat.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: stat.alert === "red" ? "#C2410C" : stat.alert === "amber" ? "#D97706" : "#1A1916" }}>{stat.value}</div>
            <div style={{ fontSize: 10, color: "#9C9590", marginTop: 2 }}>{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Growth scenario */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: "#9C9590", fontWeight: 600 }}>Growth scenario</span>
        {[0, 10, 20, 30].map(pct => (
          <button key={pct} onClick={() => setGrowthPct(pct)} style={{ padding: "3px 11px", fontSize: 11, fontWeight: 600, borderRadius: 99, cursor: "pointer", border: `1px solid ${growthPct === pct ? "#E9532A" : "#ECE7DE"}`, background: growthPct === pct ? "#E9532A" : "none", color: growthPct === pct ? "#fff" : "#6B6760" }}>
            {pct === 0 ? "Base" : `+${pct}%`}
          </button>
        ))}
        {growthPct > 0 && pipelineHours > 0 && (
          <span style={{ fontSize: 11, color: "#9C9590" }}>
            Expected demand at +{Math.round(expectedNewHours)} hrs/mo vs +{Math.round(expectedNewHoursBase)} hrs/mo base
          </span>
        )}
      </div>

      {/* Hire inputs */}
      <div style={{ display: "flex", gap: 12, marginBottom: hasHireInputs ? 16 : 4, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ minWidth: 180, flex: 1, maxWidth: 240 }}>
          <label style={labelStyle}>Annual Cost</label>
          <div style={{ display: "flex", alignItems: "center", border: "1px solid #ECE7DE", borderRadius: 6, background: "#fff" }}>
            <span style={{ padding: "0 2px 0 10px", fontSize: 13, color: "#9C9590", flexShrink: 0, userSelect: "none" as const }}>{sym}</span>
            <input
              style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: "inherit", fontSize: 13, color: "#1A1916", padding: "6px 10px 6px 4px", width: "100%", boxSizing: "border-box" as const }}
              type="number" min={0} step={1000} value={annualCost}
              onChange={e => setAnnualCost(e.target.value)} placeholder="60000" />
          </div>
        </div>
        <div style={{ minWidth: 180, flex: 1, maxWidth: 240 }}>
          <label style={labelStyle}>Billable hrs/mo</label>
          <input style={inputStyle} type="number" min={0} step={5} value={billableHrs}
            onChange={e => setBillableHrs(e.target.value)} placeholder="50" />
        </div>
        {hasHireInputs && hireMonthlyCost > 0 && (
          <div style={{ fontSize: 11, color: "#9C9590", paddingBottom: 8 }}>{fmt$(Math.round(hireMonthlyCost))}/mo cost</div>
        )}
      </div>

      {!hasHireInputs && (
        <div style={{ fontSize: 11, color: "#9C9590", marginBottom: 16, fontStyle: "italic" }}>
          Enter an annual cost and billable hours above to model a specific hire.
        </div>
      )}

      {/* Chart */}
      <div style={{ position: "relative", width: "100%", paddingTop: `${(H / W) * 100}%` }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", cursor: "crosshair" }}
          onMouseMove={handleSvgMouseMove}
          onMouseLeave={() => setHoverIdx(null)}
        >
          {/* Hiring window shading */}
          {hireRegions.map((r, i) => (
            <rect key={`h${i}`} x={r.x} y={PT} width={r.width} height={plotH} fill="#DCFCE7" opacity={0.6} />
          ))}
          {/* Revenue gap shading */}
          {gapRegions.map((r, i) => (
            <rect key={`g${i}`} x={r.x} y={PT} width={r.width} height={plotH} fill="#FEF3C7" opacity={0.5} />
          ))}

          {/* Grid + Y labels */}
          {Array.from({ length: YMAX / 25 + 1 }, (_, k) => k * 25).map(tick => (
            <g key={tick}>
              <line x1={PL} y1={toY(tick)} x2={W - PR} y2={toY(tick)} stroke="#ECE7DE" strokeWidth={1} />
              <text x={PL - 6} y={toY(tick) + 4} textAnchor="end" fontSize={10} fill="#9C9590">{tick}%</text>
            </g>
          ))}

          {/* Capacity threshold */}
          {totalCapacity > 0 && contractedHours > 0 && (
            <>
              <line x1={PL} y1={toY(CAPACITY_THRESHOLD)} x2={W - PR} y2={toY(CAPACITY_THRESHOLD)} stroke="#16A34A" strokeWidth={1} strokeDasharray="4,3" opacity={0.55} />
              <text x={W - PR - 4} y={toY(CAPACITY_THRESHOLD) - 4} fontSize={9} fill="#16A34A" textAnchor="end" opacity={0.7}>{CAPACITY_THRESHOLD}% capacity threshold</text>
            </>
          )}

          {/* People% target */}
          {hasHireInputs && activeMRR > 0 && (
            <>
              <line x1={PL} y1={toY(peoplePctTarget)} x2={W - PR} y2={toY(peoplePctTarget)} stroke="#2563EB" strokeWidth={1} strokeDasharray="4,3" opacity={0.55} />
              <text x={W - PR - 4} y={toY(peoplePctTarget) - 4} fontSize={9} fill="#2563EB" textAnchor="end" opacity={0.7}>{peoplePctTarget}% people target</text>
            </>
          )}

          {/* Potential demand line (full pipeline) — drawn behind the expected line */}
          {potentialLine && (
            <>
              <path d={potentialLine} fill="none" stroke="#D97706" strokeWidth={2} strokeDasharray="5,4" opacity={0.85} />
              {monthData.map((d, i) => (
                <circle key={`p${i}`} cx={toX(i)} cy={toY(d.potentialCapUtil)} r={2.5} fill="#fff" stroke="#D97706" strokeWidth={1.5} opacity={0.85} />
              ))}
            </>
          )}

          {/* Capacity utilization line (expected) */}
          {totalCapacity > 0 && contractedHours > 0 && (
            <>
              <path d={capLine} fill="none" stroke="#16A34A" strokeWidth={2} />
              {monthData.map((d, i) => (
                <circle key={i} cx={toX(i)} cy={toY(d.capUtil)} r={3} fill="#16A34A" opacity={0.8} />
              ))}
            </>
          )}

          {/* People % with hire line */}
          {peopleLine && (
            <>
              <path d={peopleLine} fill="none" stroke="#2563EB" strokeWidth={2} />
              {monthData.map((d, i) => (
                <circle key={i} cx={toX(i)} cy={toY(d.peoplePct)} r={3} fill="#2563EB" opacity={0.8} />
              ))}
            </>
          )}

          {/* X labels */}
          {monthLabels.map((label, i) => {
            if (i % 3 !== 0 && i !== 11) return null
            return <text key={i} x={toX(i)} y={H - 4} textAnchor="middle" fontSize={9} fill="#9C9590">{label}</text>
          })}

          {/* Legend */}
          {totalCapacity > 0 && contractedHours > 0 && (
            <>
              <line x1={PL} y1={PT - 8} x2={PL + 18} y2={PT - 8} stroke="#16A34A" strokeWidth={2} />
              <text x={PL + 22} y={PT - 4} fontSize={9} fill="#6B6760">Expected demand</text>
            </>
          )}
          {potentialLine && (
            <>
              <line x1={PL + 120} y1={PT - 8} x2={PL + 138} y2={PT - 8} stroke="#D97706" strokeWidth={2} strokeDasharray="5,4" />
              <text x={PL + 142} y={PT - 4} fontSize={9} fill="#6B6760">Potential (full pipeline)</text>
            </>
          )}
          {hasHireInputs && activeMRR > 0 && (
            <>
              <line x1={PL + 268} y1={PT - 8} x2={PL + 286} y2={PT - 8} stroke="#2563EB" strokeWidth={2} />
              <text x={PL + 290} y={PT - 4} fontSize={9} fill="#6B6760">People % with hire</text>
            </>
          )}
          {hireRegions.length > 0 && (
            <>
              <rect x={PL + 398} y={PT - 14} width={12} height={12} fill="#DCFCE7" opacity={0.8} />
              <text x={PL + 414} y={PT - 4} fontSize={9} fill="#6B6760">Hire window</text>
            </>
          )}
          {gapRegions.length > 0 && (
            <>
              <rect x={PL + 488} y={PT - 14} width={12} height={12} fill="#FEF3C7" opacity={0.8} />
              <text x={PL + 504} y={PT - 4} fontSize={9} fill="#6B6760">Revenue gap</text>
            </>
          )}

          {/* Hover indicator */}
          {hoverIdx !== null && (
            <g pointerEvents="none">
              <line x1={toX(hoverIdx)} y1={PT} x2={toX(hoverIdx)} y2={H - PB} stroke="#9C9590" strokeWidth={1} opacity={0.35} />
              {potentialLine && (
                <circle cx={toX(hoverIdx)} cy={toY(monthData[hoverIdx].potentialCapUtil)} r={4.5} fill="#D97706" stroke="#fff" strokeWidth={1.5} />
              )}
              {totalCapacity > 0 && contractedHours > 0 && (
                <circle cx={toX(hoverIdx)} cy={toY(monthData[hoverIdx].capUtil)} r={4.5} fill="#16A34A" stroke="#fff" strokeWidth={1.5} />
              )}
              {peopleLine && (
                <circle cx={toX(hoverIdx)} cy={toY(monthData[hoverIdx].peoplePct)} r={4.5} fill="#2563EB" stroke="#fff" strokeWidth={1.5} />
              )}
            </g>
          )}
        </svg>

        {/* Hover tooltip */}
        {hoverIdx !== null && (
          <div style={{
            position: "absolute",
            top: `${(PT / H) * 100}%`,
            ...(hoverIdx < 6
              ? { left: `${((toX(hoverIdx) + 18) / W) * 100}%` }
              : { right: `${((W - toX(hoverIdx) + 18) / W) * 100}%` }),
            background: "#fff",
            border: "1px solid #ECE7DE",
            borderRadius: 7,
            padding: "8px 12px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
            pointerEvents: "none",
            zIndex: 10,
            minWidth: 148,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#1A1916", marginBottom: 6 }}>{monthLabels[hoverIdx]}</div>
            {activeMRR > 0 && (
              <div style={{ fontSize: 11, color: "#6B6760", marginBottom: 3 }}>
                Revenue <strong style={{ color: "#1A1916" }}>{fmt$(Math.round(monthData[hoverIdx].revenue))}/mo</strong>
              </div>
            )}
            {totalCapacity > 0 && contractedHours > 0 && (
              <div style={{ fontSize: 11, color: "#16A34A", marginBottom: 3 }}>
                Expected <strong>{Math.round(monthData[hoverIdx].demandHours)} hrs</strong> ({Math.round(monthData[hoverIdx].capUtil)}%)
              </div>
            )}
            {potentialLine && (
              <div style={{ fontSize: 11, color: "#D97706", marginBottom: 3 }}>
                Potential <strong>{Math.round(monthData[hoverIdx].potentialDemandHours)} hrs</strong> ({Math.round(monthData[hoverIdx].potentialCapUtil)}%)
              </div>
            )}
            {hasHireInputs && activeMRR > 0 && (
              <div style={{ fontSize: 11, color: "#2563EB", marginBottom: 3 }}>
                People % <strong>{Math.round(monthData[hoverIdx].peoplePct)}%</strong>
              </div>
            )}
            {hasHireInputs && (
              <div style={{ display: "flex", gap: 5, marginTop: 7 }}>
                <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, fontWeight: 600, background: monthData[hoverIdx].capacityGate ? "#DCFCE7" : "#F3F4F6", color: monthData[hoverIdx].capacityGate ? "#166534" : "#9C9590" }}>
                  {monthData[hoverIdx].capacityGate ? "✓" : "–"} Capacity
                </span>
                <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, fontWeight: 600, background: monthData[hoverIdx].budgetGate ? "#DCFCE7" : "#F3F4F6", color: monthData[hoverIdx].budgetGate ? "#166534" : "#9C9590" }}>
                  {monthData[hoverIdx].budgetGate ? "✓" : "–"} Budget
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recommendation */}
      {msg && (
        <div style={{
          marginTop: 12, padding: "12px 16px", borderRadius: 8,
          background: msg.type === "good" ? "#F0FDF4" : msg.type === "warning" ? "#FFFBEB" : msg.type === "info" ? "#EFF6FF" : "#F9FAFB",
          borderLeft: `3px solid ${msg.type === "good" ? "#22C55E" : msg.type === "warning" ? "#F59E0B" : msg.type === "info" ? "#3B82F6" : "#9CA3AF"}`,
        }}>
          <div style={{ fontSize: 12, color: "#1A1916", lineHeight: 1.6 }}>{msg.text}</div>
          {msg.sub && (
            <div style={{ fontSize: 11, color: "#6B6760", marginTop: 8, lineHeight: 1.5 }}>
              <strong>To close the gap:</strong> {msg.sub}
            </div>
          )}
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

function PersonSalaryTable({ people, salaryMonths, hoursMonths, clientId, onSalaryMonthChange, onHoursMonthChange }: {
  people: Person[]
  salaryMonths: PersonSalaryMonth[]
  hoursMonths: PersonHoursMonth[]
  clientId: string
  onSalaryMonthChange: (sm: PersonSalaryMonth) => void
  onHoursMonthChange: (hm: PersonHoursMonth) => void
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

  const hoursMap = new Map<string, number>()
  hoursMonths.forEach(hm => hoursMap.set(`${hm.personId}:${hm.month}`, hm.monthlyHours))

  type EditTarget = { personId: string; month: string; kind: "salary" | "hours" }
  const [editingCell, setEditingCell] = useState<EditTarget | null>(null)
  const [editValue, setEditValue] = useState("")
  const [saving, setSaving] = useState(false)
  const [showVendors, setShowVendors] = useState(false)

  const hasVendors = people.some(p => p.isExternal)
  const shownPeople = showVendors ? people : people.filter(p => !p.isExternal)

  function baseMonthlySalary(p: Person) { return p.annualSalary > 0 ? Math.round(p.annualSalary / 12) : 0 }
  function baseMonthlyHours(p: Person) { return p.billableHours }

  function isActive(p: Person, mo: string) {
    const start = toYM(p.startDate)
    const end = toYM(p.endDate)
    if (start && mo < start) return false
    if (end && mo > end) return false
    return true
  }

  function salaryCellValue(personId: string, month: string, p: Person) {
    const override = salaryMap.get(`${personId}:${month}`)
    return { value: override ?? baseMonthlySalary(p), isOverride: override !== undefined }
  }

  function hoursCellValue(personId: string, month: string, p: Person) {
    const override = hoursMap.get(`${personId}:${month}`)
    return { value: override ?? baseMonthlyHours(p), isOverride: override !== undefined }
  }

  // Monthly totals across the shown people (active that month only).
  function salaryTotal(mo: string) {
    return shownPeople.reduce((s, p) => (isActive(p, mo) ? s + salaryCellValue(p.id, mo, p).value : s), 0)
  }
  function hoursTotal(mo: string) {
    return shownPeople.filter(p => !p.isExternal).reduce((s, p) => (isActive(p, mo) ? s + hoursCellValue(p.id, mo, p).value : s), 0)
  }

  async function saveCell(target: EditTarget) {
    const raw = editValue.replace(/[$£€,\s]/g, "")
    const val = parseFloat(raw)
    if (isNaN(val) || val < 0) { setEditingCell(null); return }
    setSaving(true)
    if (target.kind === "salary") {
      const res = await fetch(`/api/clients/${clientId}/people/${target.personId}/salary-months`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: target.month, monthlySalary: val }),
      })
      if (res.ok) onSalaryMonthChange({ personId: target.personId, month: target.month, monthlySalary: val })
    } else {
      const res = await fetch(`/api/clients/${clientId}/people/${target.personId}/hours-months`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: target.month, monthlyHours: val }),
      })
      if (res.ok) onHoursMonthChange({ personId: target.personId, month: target.month, monthlyHours: val })
    }
    setSaving(false)
    setEditingCell(null)
  }

  function openCell(target: EditTarget, currentValue: number) {
    setEditingCell(target)
    setEditValue(currentValue > 0 ? String(currentValue) : "")
  }

  const stickyLabel: React.CSSProperties = {
    padding: "6px 16px 6px 0", fontSize: 11, fontWeight: 600, color: "#9C9590",
    whiteSpace: "nowrap", position: "sticky", left: 0, background: "#fff", zIndex: 1,
    borderBottom: "1px solid #F5F1EC",
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1916" }}>Monthly Salary &amp; Hours</div>
        {hasVendors && (
          <button onClick={() => setShowVendors(v => !v)}
            style={{ fontSize: 11, fontWeight: 600, color: "#6B6760", background: "none", border: "1px solid #ECE7DE", borderRadius: 6, padding: "3px 10px", cursor: "pointer", whiteSpace: "nowrap" }}>
            {showVendors ? "Hide vendors" : "Show vendors"}
          </button>
        )}
      </div>
      <div style={{ fontSize: 11, color: "#9C9590", marginBottom: 14 }}>
        Grey values are defaults (salary ÷ 12; billable hrs for hours). Click any cell to override — e.g. when someone changes hours or gets a raise.
      </div>
      <div ref={scrollRef} style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", fontSize: 11, fontWeight: 600, color: "#9C9590", padding: "4px 16px 4px 0", borderBottom: "1px solid #ECE7DE", minWidth: 160, whiteSpace: "nowrap", position: "sticky", left: 0, background: "#fff", zIndex: 1 }}>
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
            {shownPeople.map((p) => {
              const rowBorder = "1px solid #ECE7DE"
              return (
                <>
                  {/* Salary row */}
                  <tr key={`${p.id}-salary`}>
                    <td style={{ ...stickyLabel, paddingTop: 10, borderBottom: "none", fontWeight: 500, fontSize: 13, color: "#1A1916" }}>
                      <div>{p.name}</div>
                      {p.isExternal && <div style={{ fontSize: 10, color: "#9C9590", marginTop: 1 }}>Vendor</div>}
                    </td>
                    {months.map(mo => {
                      const active = isActive(p, mo)
                      const { value, isOverride } = salaryCellValue(p.id, mo, p)
                      const target: EditTarget = { personId: p.id, month: mo, kind: "salary" }
                      const isEditing = editingCell?.personId === p.id && editingCell.month === mo && editingCell.kind === "salary"
                      return (
                        <td key={mo} style={{ padding: "4px 4px", textAlign: "right", borderBottom: "none", minWidth: 86, background: active ? undefined : "#FAFAF8" }}>
                          {active && isEditing ? (
                            <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)}
                              onBlur={() => saveCell(target)}
                              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); saveCell(target) } if (e.key === "Escape") setEditingCell(null) }}
                              disabled={saving}
                              style={{ width: 78, textAlign: "right", fontSize: 12, border: "1px solid #E9532A", borderRadius: 4, padding: "3px 6px", outline: "none", fontFamily: "inherit", fontVariantNumeric: "tabular-nums" }} />
                          ) : (
                            <button type="button" onClick={() => active && openCell(target, value)}
                              style={{ background: "none", border: "none", cursor: active ? "pointer" : "default", padding: "3px 8px", fontSize: 12, fontVariantNumeric: "tabular-nums", borderRadius: 4, color: !active ? "#ECE7DE" : isOverride ? "#1A1916" : "#C0BAB2", fontWeight: isOverride ? 600 : 400, width: "100%", textAlign: "right" }}>
                              {active && value > 0 ? fmt$(value) : "—"}
                            </button>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                  {/* Hours row — internal only */}
                  {!p.isExternal && (
                    <tr key={`${p.id}-hours`}>
                      <td style={{ ...stickyLabel, paddingTop: 2, borderBottom: rowBorder }}>
                        <span style={{ color: "#9C9590", fontSize: 11 }}>hrs/mo</span>
                      </td>
                      {months.map(mo => {
                        const active = isActive(p, mo)
                        const { value, isOverride } = hoursCellValue(p.id, mo, p)
                        const target: EditTarget = { personId: p.id, month: mo, kind: "hours" }
                        const isEditing = editingCell?.personId === p.id && editingCell.month === mo && editingCell.kind === "hours"
                        return (
                          <td key={mo} style={{ padding: "4px 4px", textAlign: "right", borderBottom: rowBorder, minWidth: 86, background: active ? undefined : "#FAFAF8" }}>
                            {active && isEditing ? (
                              <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)}
                                onBlur={() => saveCell(target)}
                                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); saveCell(target) } if (e.key === "Escape") setEditingCell(null) }}
                                disabled={saving}
                                style={{ width: 78, textAlign: "right", fontSize: 12, border: "1px solid #E9532A", borderRadius: 4, padding: "3px 6px", outline: "none", fontFamily: "inherit", fontVariantNumeric: "tabular-nums" }} />
                            ) : (
                              <button type="button" onClick={() => active && openCell(target, value)}
                                style={{ background: "none", border: "none", cursor: active ? "pointer" : "default", padding: "3px 8px", fontSize: 12, fontVariantNumeric: "tabular-nums", borderRadius: 4, color: !active ? "#ECE7DE" : isOverride ? "#1A1916" : "#C0BAB2", fontWeight: isOverride ? 600 : 400, width: "100%", textAlign: "right" }}>
                                {active ? `${value}h` : "—"}
                              </button>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )}
                  {/* Spacer for external vendors (no hours row) */}
                  {p.isExternal && (
                    <tr key={`${p.id}-spacer`}>
                      <td colSpan={months.length + 1} style={{ borderBottom: rowBorder, padding: 0, height: 1 }} />
                    </tr>
                  )}
                </>
              )
            })}

            {/* Totals */}
            {shownPeople.length > 0 && (
              <>
                <tr key="total-salary">
                  <td style={{ ...stickyLabel, paddingTop: 12, borderTop: "2px solid #ECE7DE", borderBottom: "none", fontWeight: 700, fontSize: 13, color: "#1A1916" }}>
                    Total{showVendors ? "" : " (team)"}
                  </td>
                  {months.map(mo => {
                    const t = salaryTotal(mo)
                    return (
                      <td key={mo} style={{ padding: "10px 8px 4px", textAlign: "right", borderTop: "2px solid #ECE7DE", borderBottom: "none", minWidth: 86, fontSize: 12, fontWeight: 700, color: "#1A1916", fontVariantNumeric: "tabular-nums" }}>
                        {t > 0 ? fmt$(t) : "—"}
                      </td>
                    )
                  })}
                </tr>
                <tr key="total-hours">
                  <td style={{ ...stickyLabel, paddingTop: 2, borderBottom: "none" }}>
                    <span style={{ color: "#9C9590", fontSize: 11 }}>hrs/mo</span>
                  </td>
                  {months.map(mo => {
                    const t = hoursTotal(mo)
                    return (
                      <td key={mo} style={{ padding: "2px 8px 8px", textAlign: "right", borderBottom: "none", minWidth: 86, fontSize: 12, fontWeight: 700, color: "#6B6760", fontVariantNumeric: "tabular-nums" }}>
                        {t > 0 ? `${Math.round(t)}h` : "—"}
                      </td>
                    )
                  })}
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
