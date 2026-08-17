"use client"
import { useState } from "react"
import { fmtCurrency, ymLabel, ymAdd, bookedAhead, currentMRR, BOOKED_AHEAD_MONTHS, type ContractRow } from "@/lib/calc"
import { useFmtCurrency } from "@/lib/CurrencyContext"
import PaymentScheduleModal from "./PaymentScheduleModal"
import ProjectPulse, { type Pulse } from "./ProjectPulse"

interface Contract {
  id: string
  name: string
  monthly: number
  hoursPerMonth: number
  actualHours?: number | null
  start: string
  contractedThrough: string | null
  status: string
  type: string
  accountId?: string | null
  ownerId?: string | null
  callDate: string | null
  signedDate: string | null
  kickoffDate: string | null
}

interface Account {
  id: string
  name: string
}

interface Person {
  id: string
  name: string
  isExternal: boolean
}

interface Product {
  id: string
  name: string
  type: string
  monthly: number
}

interface Props {
  clientId: string
  initialContracts: Contract[]
  accounts?: Account[]
  products?: Product[]
  people?: Person[]
  pulses?: Pulse[]
  onPulseChange?: (pulse: Pulse) => void
  minHourlyRate?: number | null
  onContractsChange?: (contracts: Contract[]) => void
  onAccountCreated?: (account: Account) => void
}

type ContractStatus = "opportunity" | "potential" | "active" | "lost" | "finished"

const STATUS_LABELS: Record<ContractStatus, string> = { opportunity: "Opportunity", potential: "Qualified", active: "Active", lost: "Lost", finished: "Finished" }
const STATUS_COLORS: Record<ContractStatus, { bg: string; text: string }> = {
  opportunity: { bg: "#EFF6FF", text: "#1D4ED8" },
  potential: { bg: "#FFF7ED", text: "#92400E" },
  active: { bg: "#DCFCE7", text: "#166534" },
  lost: { bg: "#FEF2F2", text: "#991B1B" },
  finished: { bg: "#F3F4F6", text: "#6B7280" },
}

function toRow(c: Contract): ContractRow {
  return { monthly: c.monthly, start: c.start, contractedThrough: c.contractedThrough, status: c.status as "active" | "potential", type: c.type as "retainer" | "oneoff" }
}

const now = new Date().toISOString().slice(0, 7)

const inputStyle: React.CSSProperties = {
  padding: "7px 10px", border: "1px solid #ECE7DE", borderRadius: 6,
  fontSize: 13, background: "#fff", color: "#1A1916",
  width: "100%", boxSizing: "border-box", fontFamily: "inherit", outline: "none",
}
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "#6B6760", display: "block", marginBottom: 4 }

type ContractTypeField = "retainer" | "ongoing" | "oneoff"

// ── Account combobox ─────────────────────────────────────────────────────────

function AccountCombobox({ accounts, value, onChange, clientId, onAccountCreated }: {
  accounts: Account[]
  value: string | null
  onChange: (id: string | null) => void
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
    setCreating(false)
    setNewName("")
    setOpen(false)
    setSearch("")
  }

  function close() { setOpen(false); setSearch(""); setCreating(false); setNewName("") }

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{ ...inputStyle, textAlign: "left", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <span style={{ color: selected ? "#1A1916" : "#9C9590", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selected ? selected.name : "— No account —"}
        </span>
        <span style={{ color: "#9C9590", fontSize: 10, flexShrink: 0, marginLeft: 4 }}>▾</span>
      </button>

      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={close} />
          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100, background: "#fff", border: "1px solid #ECE7DE", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.1)", marginTop: 2, maxHeight: 280, overflowY: "auto" }}>
            {/* Search */}
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

            {/* Add new */}
            {!creating ? (
              <button type="button" onClick={() => setCreating(true)}
                style={{ width: "100%", padding: "8px 12px", textAlign: "left", background: "none", border: "none", borderBottom: "1px solid #F5F1EC", fontSize: 12, color: "#E9532A", fontWeight: 600, cursor: "pointer" }}>
                + Add new account
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

            {/* None */}
            <button type="button" onClick={() => { onChange(null); close() }}
              style={{ width: "100%", padding: "7px 12px", textAlign: "left", background: value === null ? "#FBFAF7" : "none", border: "none", borderBottom: "1px solid #F5F1EC", fontSize: 12, color: "#9C9590", cursor: "pointer" }}>
              — No account —
            </button>

            {/* Accounts */}
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



// ─────────────────────────────────────────────────────────────────────────────

interface EditForm {
  name: string
  monthly: string
  hoursPerMonth: string
  start: string
  contractedThrough: string
  status: ContractStatus
  type: ContractTypeField
  accountId: string | null
  ownerId: string | null
}

function DuplicateModal({ contract, clientId, accounts, onClose, onSave, onAccountCreated }: { contract: Contract; clientId: string; accounts?: Account[]; onClose: () => void; onSave: (c: Contract) => void; onAccountCreated: (a: Account) => void }) {
  const uiType: ContractTypeField = !contract.contractedThrough && contract.type === "retainer" ? "ongoing" : (contract.type as ContractTypeField) ?? "retainer"
  const [form, setForm] = useState<EditForm>({
    name: "",
    monthly: String(contract.monthly),
    hoursPerMonth: String(contract.hoursPerMonth),
    start: contract.start,
    contractedThrough: contract.contractedThrough ?? "",
    status: "potential" as ContractStatus,
    type: uiType,
    accountId: contract.accountId ?? null,
    ownerId: contract.ownerId ?? null,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const isOngoing = form.type === "ongoing"
    const payload = {
      ...form,
      monthly: parseFloat(form.monthly),
      hoursPerMonth: parseFloat(form.hoursPerMonth) || 0,
      type: isOngoing ? "retainer" : form.type,
      contractedThrough: isOngoing ? null : form.type === "oneoff" ? form.start : form.contractedThrough || null,
      accountId: form.accountId || undefined,
    }
    const res = await fetch(`/api/clients/${clientId}/contracts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    if (!res.ok) { setError("Failed to save"); return }
    const created = await res.json()
    onSave({ ...(created.contract ?? created), accountId: form.accountId })
    onClose()
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: "#fff", borderRadius: 14, padding: 28, width: 460, boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
        <h2 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 22, fontWeight: 600, margin: "0 0 4px", color: "#1A1916" }}>
          Duplicate Project
        </h2>
        <p style={{ fontSize: 12, color: "#9C9590", margin: "0 0 20px" }}>Copied from <strong style={{ color: "#6B6760" }}>{contract.name}</strong> — enter a new name to save.</p>
        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Type</label>
              <select style={inputStyle} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as ContractTypeField }))}>
                <option value="retainer">Retainer – End Date</option>
                <option value="ongoing">Retainer – Ongoing</option>
                <option value="oneoff">One-off</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select style={inputStyle} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as ContractStatus }))}>
                <option value="opportunity">Opportunity</option>
                <option value="potential">Qualified</option>
                <option value="active">Active</option>
                <option value="lost">Lost</option>
                <option value="finished">Finished</option>
              </select>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Client Account</label>
            <AccountCombobox
              accounts={accounts ?? []}
              value={form.accountId}
              onChange={id => setForm(f => ({ ...f, accountId: id }))}
              clientId={clientId}
              onAccountCreated={a => { onAccountCreated(a); setForm(f => ({ ...f, accountId: a.id })) }}
            />
          </div>
          <div>
            <label style={labelStyle}>Project Name</label>
            <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="New project name" autoFocus />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>{form.type === "oneoff" ? "Amount ($)" : "Monthly ($)"}</label>
              <input style={inputStyle} type="number" value={form.monthly} onChange={e => setForm(f => ({ ...f, monthly: e.target.value }))} required min={0} />
            </div>
            <div>
              <label style={labelStyle}>Hours / mo</label>
              <input style={inputStyle} type="number" value={form.hoursPerMonth} onChange={e => setForm(f => ({ ...f, hoursPerMonth: e.target.value }))} min={0} step={0.5} placeholder="0" />
            </div>
          </div>
          {form.type === "oneoff" ? (
            <div>
              <label style={labelStyle}>Month Paid</label>
              <input style={inputStyle} type="month" value={form.start} onChange={e => setForm(f => ({ ...f, start: e.target.value, contractedThrough: e.target.value }))} required />
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: form.type === "ongoing" ? "1fr" : "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Start</label>
                <input style={inputStyle} type="month" value={form.start} onChange={e => setForm(f => ({ ...f, start: e.target.value }))} required />
              </div>
              {form.type === "retainer" && (
                <div>
                  <label style={labelStyle}>Through</label>
                  <input style={inputStyle} type="month" value={form.contractedThrough} onChange={e => setForm(f => ({ ...f, contractedThrough: e.target.value }))} required />
                </div>
              )}
            </div>
          )}
          {error && <div style={{ fontSize: 13, color: "#C2410C" }}>{error}</div>}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
            <button type="button" onClick={onClose}
              style={{ padding: "8px 16px", background: "none", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 13, cursor: "pointer", color: "#6B6760" }}>
              Cancel
            </button>
            <button type="submit" disabled={saving}
              style={{ padding: "8px 18px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Saving…" : "Save Copy"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EditModal({ contract, clientId, accounts, people = [], onClose, onSave, onAccountCreated }: { contract: Contract; clientId: string; accounts?: Account[]; people?: Person[]; onClose: () => void; onSave: (c: Contract) => void; onAccountCreated: (a: Account) => void }) {
  const uiType: ContractTypeField = !contract.contractedThrough && contract.type === "retainer" ? "ongoing" : (contract.type as ContractTypeField) ?? "retainer"
  const teamMembers = people.filter(p => !p.isExternal)
  const [form, setForm] = useState<EditForm>({
    name: contract.name,
    monthly: String(contract.monthly),
    hoursPerMonth: String(contract.hoursPerMonth),
    start: contract.start,
    contractedThrough: contract.contractedThrough ?? "",
    status: contract.status as ContractStatus,
    type: uiType,
    accountId: contract.accountId ?? null,
    ownerId: contract.ownerId ?? null,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const isOngoing = form.type === "ongoing"
    const payload = {
      ...form,
      monthly: parseFloat(form.monthly),
      hoursPerMonth: parseFloat(form.hoursPerMonth) || 0,
      type: isOngoing ? "retainer" : form.type,
      contractedThrough: isOngoing ? null : form.type === "oneoff" ? form.start : form.contractedThrough || null,
      accountId: form.accountId,
      ownerId: form.ownerId,
    }
    const res = await fetch(`/api/contracts/${contract.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    if (!res.ok) { setError("Failed to save"); return }
    const updated = await res.json()
    onSave({ ...updated, accountId: form.accountId, ownerId: form.ownerId })
    onClose()
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: "#fff", borderRadius: 14, padding: 28, width: 460, boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
        <h2 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 22, fontWeight: 600, margin: "0 0 20px", color: "#1A1916" }}>
          Edit Project
        </h2>
        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Type</label>
              <select style={inputStyle} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as ContractTypeField }))}>
                <option value="retainer">Retainer – End Date</option>
                <option value="ongoing">Retainer – Ongoing</option>
                <option value="oneoff">One-off</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select style={inputStyle} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as ContractStatus }))}>
                <option value="opportunity">Opportunity</option>
                <option value="potential">Qualified</option>
                <option value="active">Active</option>
                <option value="lost">Lost</option>
                <option value="finished">Finished</option>
              </select>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Client Account</label>
            <AccountCombobox
              accounts={accounts ?? []}
              value={form.accountId}
              onChange={id => setForm(f => ({ ...f, accountId: id }))}
              clientId={clientId}
              onAccountCreated={a => { onAccountCreated(a); setForm(f => ({ ...f, accountId: a.id })) }}
            />
          </div>
          {teamMembers.length > 0 && (
            <div>
              <label style={labelStyle}>Owner <span style={{ color: "#C0BAB2", fontWeight: 400 }}>(optional)</span></label>
              <select style={inputStyle} value={form.ownerId ?? ""} onChange={e => setForm(f => ({ ...f, ownerId: e.target.value || null }))}>
                <option value="">Unassigned</option>
                {teamMembers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label style={labelStyle}>Project Name</label>
            <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>{form.type === "oneoff" ? "Amount ($)" : "Monthly ($)"}</label>
              <input style={inputStyle} type="number" value={form.monthly} onChange={e => setForm(f => ({ ...f, monthly: e.target.value }))} required min={0} />
            </div>
            <div>
              <label style={labelStyle}>Hours / mo</label>
              <input style={inputStyle} type="number" value={form.hoursPerMonth} onChange={e => setForm(f => ({ ...f, hoursPerMonth: e.target.value }))} min={0} step={0.5} placeholder="0" />
            </div>
          </div>
          {form.type === "oneoff" ? (
            <div>
              <label style={labelStyle}>Month Paid</label>
              <input style={inputStyle} type="month" value={form.start} onChange={e => setForm(f => ({ ...f, start: e.target.value, contractedThrough: e.target.value }))} required />
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: form.type === "ongoing" ? "1fr" : "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Start</label>
                <input style={inputStyle} type="month" value={form.start} onChange={e => setForm(f => ({ ...f, start: e.target.value }))} required />
              </div>
              {form.type === "retainer" && (
                <div>
                  <label style={labelStyle}>Through</label>
                  <input style={inputStyle} type="month" value={form.contractedThrough} onChange={e => setForm(f => ({ ...f, contractedThrough: e.target.value }))} required />
                </div>
              )}
            </div>
          )}
          {error && <div style={{ fontSize: 13, color: "#C2410C" }}>{error}</div>}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
            <button type="button" onClick={onClose}
              style={{ padding: "8px 16px", background: "none", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 13, cursor: "pointer", color: "#6B6760" }}>
              Cancel
            </button>
            <button type="submit" disabled={saving}
              style={{ padding: "8px 18px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const contractsResponsiveStyle = `
  @media (max-width: 640px) {
    .contract-row { flex-wrap: wrap !important; gap: 6px 10px !important; }
    .contract-row-actions { flex: 1 1 100% !important; }
    .contract-gantt-wrap { overflow-x: auto; }
    .contract-add-grid { grid-template-columns: 1fr 1fr !important; }
    .contract-add-grid2 { grid-template-columns: 1fr 1fr !important; }
  }
`

export default function ContractsPanel({ clientId, initialContracts, accounts: accountsProp, products, people = [], pulses = [], onPulseChange, minHourlyRate: minHourlyRateProp, onContractsChange, onAccountCreated: onAccountCreatedProp }: Props) {
  const fmtCurrency = useFmtCurrency()
  const [contracts, setContracts] = useState<Contract[]>(initialContracts)
  const [localAccounts, setLocalAccounts] = useState<Account[]>(accountsProp ?? [])
  const minHourlyRate = minHourlyRateProp ?? null
  const teamMembers = people.filter(p => !p.isExternal)
  const [adding, setAdding] = useState(false)

  const [editingContract, setEditingContract] = useState<Contract | null>(null)
  const [schedulingContract, setSchedulingContract] = useState<Contract | null>(null)
  const [duplicatingContract, setDuplicatingContract] = useState<Contract | null>(null)
  const [form, setForm] = useState({ name: "", monthly: "", hoursPerMonth: "", start: now, contractedThrough: "", status: "potential" as ContractStatus, type: "retainer" as ContractTypeField, accountId: null as string | null, ownerId: null as string | null })
  const [saving, setSaving] = useState(false)
  const [showPast, setShowPast] = useState(false)
  const [showAllGantt, setShowAllGantt] = useState(false)
  const [view, setView] = useState<"timeline" | "yield">("timeline")

  function handleAccountCreated(account: Account) {
    setLocalAccounts(prev => [...prev, account].sort((a, b) => a.name.localeCompare(b.name)))
    onAccountCreatedProp?.(account)
  }

  function updateContracts(next: Contract[]) {
    setContracts(next)
    onContractsChange?.(next)
  }

  const rows = contracts.map(toRow)
  const mrr = currentMRR(rows, now)
  const booked = bookedAhead(rows, now)

  const byStatus = {
    active: contracts.filter(c => c.status === "active").sort((a, b) => a.start.localeCompare(b.start)),
    potential: contracts.filter(c => c.status === "potential").sort((a, b) => a.start.localeCompare(b.start)),
    finished: contracts.filter(c => c.status === "finished").sort((a, b) => a.start.localeCompare(b.start)),
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const isOngoing = form.type === "ongoing"
    const payload = {
      ...form,
      monthly: parseFloat(form.monthly),
      hoursPerMonth: parseFloat(form.hoursPerMonth) || 0,
      type: isOngoing ? "retainer" : form.type,
      contractedThrough: isOngoing ? null : form.type === "oneoff" ? form.start : form.contractedThrough || null,
    }
    const res = await fetch(`/api/clients/${clientId}/contracts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (res.ok) {
      updateContracts([...contracts, data.contract ?? data])
      setForm({ name: "", monthly: "", hoursPerMonth: "", start: now, contractedThrough: "", status: "potential", type: "retainer", accountId: null, ownerId: null })
      setAdding(false)
    }
    setSaving(false)
  }

  async function handleDelete(contractId: string) {
    await fetch(`/api/contracts/${contractId}`, { method: "DELETE" })
    updateContracts(contracts.filter(c => c.id !== contractId))
  }

  function handleEdited(updated: Contract) {
    updateContracts(contracts.map(c => c.id === updated.id ? updated : c))
  }

  function handleDuplicated(created: Contract) {
    updateContracts([...contracts, created])
  }

  // Inline hours edits from the yield table — optimistic, persisted via PATCH.
  // Returns whether the save succeeded, so the table can show a saved ✓.
  async function patchContract(contractId: string, patch: Partial<Contract>): Promise<boolean> {
    updateContracts(contracts.map(c => c.id === contractId ? { ...c, ...patch } : c))
    try {
      const res = await fetch(`/api/contracts/${contractId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      return res.ok
    } catch {
      return false
    }
  }
  const handleHoursChange = (contractId: string, hours: number) => patchContract(contractId, { hoursPerMonth: hours })
  const handleOwnerChange = (contractId: string, ownerId: string | null) => { patchContract(contractId, { ownerId }) }

  return (
    <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 20 }}>
      <style>{contractsResponsiveStyle}</style>
      {editingContract && (
        <EditModal contract={editingContract} clientId={clientId} accounts={localAccounts} people={people} onClose={() => setEditingContract(null)} onSave={handleEdited} onAccountCreated={handleAccountCreated} />
      )}
      {schedulingContract && (
        <PaymentScheduleModal contractId={schedulingContract.id} projectName={schedulingContract.name} mode={schedulingContract.type === "oneoff" ? "oneoff" : "retainer"} total={schedulingContract.monthly} startMonth={schedulingContract.start} endMonth={schedulingContract.contractedThrough} onClose={() => setSchedulingContract(null)} />
      )}
      {duplicatingContract && (
        <DuplicateModal contract={duplicatingContract} clientId={clientId} accounts={localAccounts} onClose={() => setDuplicatingContract(null)} onSave={handleDuplicated} onAccountCreated={handleAccountCreated} />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1916" }}>Projects</div>
          <div style={{ fontSize: 11, color: "#9C9590", marginTop: 2 }}>
            MRR {fmtCurrency(mrr)} · {fmtCurrency(booked)} booked (next {BOOKED_AHEAD_MONTHS} mo)
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setAdding(a => !a)}
            style={{ padding: "6px 14px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            + Add Project
          </button>
        </div>
      </div>

      {adding && (
        <form onSubmit={handleAdd} style={{ background: "#FBFAF7", border: "1px solid #ECE7DE", borderRadius: 8, padding: 16, marginBottom: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {products && products.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 10, borderBottom: "1px solid #ECE7DE" }}>
              <span style={{ fontSize: 11, color: "#9C9590", fontWeight: 600, whiteSpace: "nowrap" }}>Start from product:</span>
              <select
                style={{ fontSize: 12, border: "1px solid #ECE7DE", borderRadius: 6, padding: "4px 8px", color: "#1A1916", background: "#fff", outline: "none", cursor: "pointer" }}
                value=""
                onChange={e => {
                  const p = products.find(p => p.id === e.target.value)
                  if (p) setForm(f => ({ ...f, name: p.name, type: p.type as ContractTypeField, monthly: String(p.monthly) }))
                }}
              >
                <option value="">— Select a product —</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          <div className="contract-add-grid" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
            <div>
              <label style={{ fontSize: 11, color: "#9C9590", display: "block", marginBottom: 4 }}>Project Name</label>
              <input style={{ ...inputStyle, background: "#FBFAF7" }} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Project Name" autoFocus />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "#9C9590", display: "block", marginBottom: 4 }}>Type</label>
              <select style={{ ...inputStyle, background: "#FBFAF7" }} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as ContractTypeField }))}>
                <option value="retainer">Retainer – End Date</option>
                <option value="ongoing">Retainer – Ongoing</option>
                <option value="oneoff">One-off</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "#9C9590", display: "block", marginBottom: 4 }}>{form.type === "oneoff" ? "Amount ($)" : "Monthly ($)"}</label>
              <input style={{ ...inputStyle, background: "#FBFAF7" }} type="number" value={form.monthly} onChange={e => setForm(f => ({ ...f, monthly: e.target.value }))} required placeholder="5000" />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "#9C9590", display: "block", marginBottom: 4 }}>Hrs / mo</label>
              <input style={{ ...inputStyle, background: "#FBFAF7" }} type="number" value={form.hoursPerMonth} onChange={e => setForm(f => ({ ...f, hoursPerMonth: e.target.value }))} min={0} step={0.5} placeholder="0" />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "#9C9590", display: "block", marginBottom: 4 }}>Status</label>
              <select style={{ ...inputStyle, background: "#FBFAF7" }} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as ContractStatus }))}>
                <option value="opportunity">Opportunity</option>
                <option value="potential">Qualified</option>
                <option value="active">Active</option>
                <option value="lost">Lost</option>
                <option value="finished">Finished</option>
              </select>
            </div>
            <button type="submit" disabled={saving} style={{ padding: "6px 14px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", height: 32, alignSelf: "end" }}>
              Save
            </button>
          </div>
          <div className="contract-add-grid2" style={{ display: "grid", gridTemplateColumns: form.type === "retainer" ? "1fr 1fr 1fr 1fr" : "1fr 1fr 2fr", gap: 8 }}>
            <div>
              <label style={{ fontSize: 11, color: "#9C9590", display: "block", marginBottom: 4 }}>Account</label>
              <AccountCombobox
                accounts={localAccounts}
                value={form.accountId}
                onChange={id => setForm(f => ({ ...f, accountId: id }))}
                clientId={clientId}
                onAccountCreated={handleAccountCreated}
              />
            </div>
            {form.type === "oneoff" ? (
              <div>
                <label style={{ fontSize: 11, color: "#9C9590", display: "block", marginBottom: 4 }}>Month Paid</label>
                <input style={{ ...inputStyle, background: "#FBFAF7" }} type="month" value={form.start} onChange={e => setForm(f => ({ ...f, start: e.target.value, contractedThrough: e.target.value }))} required />
              </div>
            ) : (
              <>
                <div>
                  <label style={{ fontSize: 11, color: "#9C9590", display: "block", marginBottom: 4 }}>Start</label>
                  <input style={{ ...inputStyle, background: "#FBFAF7" }} type="month" value={form.start} onChange={e => setForm(f => ({ ...f, start: e.target.value }))} required />
                </div>
                {form.type === "retainer" && (
                  <div>
                    <label style={{ fontSize: 11, color: "#9C9590", display: "block", marginBottom: 4 }}>Through</label>
                    <input style={{ ...inputStyle, background: "#FBFAF7" }} type="month" value={form.contractedThrough} onChange={e => setForm(f => ({ ...f, contractedThrough: e.target.value }))} required />
                  </div>
                )}
              </>
            )}
          </div>
          {teamMembers.length > 0 && (
            <div style={{ maxWidth: 240 }}>
              <label style={{ fontSize: 11, color: "#9C9590", display: "block", marginBottom: 4 }}>Owner <span style={{ color: "#C0BAB2" }}>(optional)</span></label>
              <select style={{ ...inputStyle, background: "#FBFAF7" }} value={form.ownerId ?? ""} onChange={e => setForm(f => ({ ...f, ownerId: e.target.value || null }))}>
                <option value="">Unassigned</option>
                {teamMembers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
        </form>
      )}

      {contracts.length === 0 ? (
        <div style={{ color: "#9C9590", fontSize: 13 }}>No contracts yet.</div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 2, background: "#F5F1EC", borderRadius: 6, padding: 2, width: "fit-content", marginBottom: 12 }}>
            {([["timeline", "Timeline"], ["yield", "Hourly yield"]] as const).map(([v, label]) => (
              <button key={v} onClick={() => setView(v)}
                style={{ padding: "4px 12px", fontSize: 11, fontWeight: 600, border: "none", borderRadius: 4, cursor: "pointer", background: view === v ? "#fff" : "transparent", color: view === v ? "#1A1916" : "#9C9590", boxShadow: view === v ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
                {label}
              </button>
            ))}
          </div>
          {view === "timeline" ? (
            <div className="contract-gantt-wrap">
              <ContractGantt
                contracts={showAllGantt ? contracts : contracts.filter(c => c.status !== "finished")}
                accounts={localAccounts}
                now={now}
                showAll={showAllGantt}
                onToggleShowAll={() => setShowAllGantt(v => !v)}
              />
            </div>
          ) : (
            <HourlyYieldTable
              contracts={contracts}
              accounts={localAccounts}
              minHourlyRate={minHourlyRate}
              onHoursChange={handleHoursChange}
            />
          )}

          {/* Active */}
          {byStatus.active.length > 0 && (
            <ContractSection
              title="Active"
              contracts={byStatus.active}
              accounts={localAccounts}
              people={people}
              pulses={pulses}
              onPulseChange={onPulseChange}
              onOwnerChange={handleOwnerChange}
              onEdit={setEditingContract}
onSchedule={setSchedulingContract}
              onDelete={handleDelete}
              onDuplicate={setDuplicatingContract}
            />
          )}

          {/* Pipeline */}
          {byStatus.potential.length > 0 && (
            <ContractSection
              title="Pipeline"
              contracts={byStatus.potential}
              accounts={localAccounts}
              people={people}
              pulses={pulses}
              onPulseChange={onPulseChange}
              onOwnerChange={handleOwnerChange}
              onEdit={setEditingContract}
onSchedule={setSchedulingContract}
              onDelete={handleDelete}
              onDuplicate={setDuplicatingContract}
            />
          )}

          {/* Past (collapsed by default) */}
          {byStatus.finished.length > 0 && (
            <div style={{ marginTop: byStatus.active.length || byStatus.potential.length ? 12 : 0 }}>
              <button
                onClick={() => setShowPast(p => !p)}
                style={{ background: "none", border: "none", fontSize: 11, fontWeight: 600, color: "#9C9590", cursor: "pointer", padding: 0, textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 4 }}
              >
                <span style={{ fontSize: 10 }}>{showPast ? "▾" : "▸"}</span>
                Past ({byStatus.finished.length})
              </button>
              {showPast && (
                <ContractSection
                  title=""
                  contracts={byStatus.finished}
                  accounts={localAccounts}
                  people={people}
                  pulses={pulses}
                  onPulseChange={onPulseChange}
                  onOwnerChange={handleOwnerChange}
                  onEdit={setEditingContract}
onSchedule={setSchedulingContract}
                  onDelete={handleDelete}
                  onDuplicate={setDuplicatingContract}
                  dimmed
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ContractSection({ title, contracts, accounts, people, pulses, onPulseChange, onOwnerChange, onEdit, onDelete, onDuplicate, onSchedule, dimmed }: {
  title: string
  contracts: Contract[]
  accounts: Account[]
  people: Person[]
  pulses: Pulse[]
  onPulseChange?: (pulse: Pulse) => void
  onOwnerChange: (contractId: string, ownerId: string | null) => void
  onEdit: (c: Contract) => void
  onDelete: (id: string) => void
  onDuplicate: (c: Contract) => void
  onSchedule: (c: Contract) => void
  dimmed?: boolean
}) {
  const fmtCurrency = useFmtCurrency()
  const teamMembers = people.filter(p => !p.isExternal)
  const nowYM = new Date().toISOString().slice(0, 7)
  const prevYM = ymAdd(nowYM, -1)
  const pulseFor = (contractId: string, month: string) => pulses.find(p => p.contractId === contractId && p.month === month)
  return (
    <div style={{ marginTop: title ? 12 : 4 }}>
      {title && (
        <div style={{ fontSize: 10, fontWeight: 700, color: "#9C9590", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, paddingBottom: 4, borderBottom: "1px solid #F5F1EC" }}>
          {title}
        </div>
      )}
      {contracts.map(c => {
        const s = (c.status as ContractStatus) in STATUS_COLORS ? c.status as ContractStatus : "potential"
        const colors = STATUS_COLORS[s]
        const isOneoff = c.type === "oneoff"
        const accountName = c.accountId ? accounts.find(a => a.id === c.accountId)?.name : null
        return (
          <div key={c.id} className="contract-row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid #F5F1EC", opacity: dimmed ? 0.6 : 1 }}>
            <div style={{ flex: "1 1 160px", minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#1A1916" }}>{c.name}</div>
              <div style={{ fontSize: 11, color: "#9C9590", marginTop: 2 }}>
                {accountName
                  ? <span style={{ color: "#6B6760", fontWeight: 500 }}>{accountName} · </span>
                  : <span style={{ color: "#C2410C", fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>Unassigned · </span>
                }
                {isOneoff
                  ? ymLabel(c.start)
                  : c.contractedThrough
                  ? `${ymLabel(c.start)} – ${ymLabel(c.contractedThrough)}`
                  : `${ymLabel(c.start)} – Ongoing`}
              </div>
              {teamMembers.length > 0 && (
                <div style={{ fontSize: 11, color: "#9C9590", marginTop: 4, display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ color: "#B0A9A0" }}>Owner</span>
                  <select value={c.ownerId ?? ""} onChange={e => onOwnerChange(c.id, e.target.value || null)}
                    style={{ fontSize: 11, border: "1px solid #ECE7DE", borderRadius: 5, padding: "2px 6px", background: "#fff", color: c.ownerId ? "#1A1916" : "#9C9590", fontFamily: "inherit", cursor: "pointer", maxWidth: 170 }}>
                    <option value="">Unassigned</option>
                    {teamMembers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="contract-row-actions" style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1A1916", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                {fmtCurrency(c.monthly)}{isOneoff ? "" : "/mo"}
              </div>
              {isOneoff && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: "#EFF6FF", color: "#1D4ED8", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
                  One-off
                </span>
              )}
              <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: colors.bg, color: colors.text, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
                {STATUS_LABELS[s]}
              </span>
              {c.status === "active" && (
                <ProjectPulse contractId={c.id} current={pulseFor(c.id, nowYM)} prev={pulseFor(c.id, prevYM)} onSaved={p => onPulseChange?.(p)} />
              )}
              <button onClick={() => onSchedule(c)} title="Payment schedule" style={{ background: "none", border: "1px solid #ECE7DE", borderRadius: 5, color: "#6B6760", cursor: "pointer", fontSize: 12, padding: "3px 10px", whiteSpace: "nowrap" }}>Schedule</button>
              <button onClick={() => onDuplicate(c)} style={{ background: "none", border: "1px solid #ECE7DE", borderRadius: 5, color: "#6B6760", cursor: "pointer", fontSize: 12, padding: "3px 10px" }}>Copy</button>
              <button onClick={() => onEdit(c)} style={{ background: "none", border: "1px solid #ECE7DE", borderRadius: 5, color: "#6B6760", cursor: "pointer", fontSize: 12, padding: "3px 10px" }}>Edit</button>
              <button onClick={() => onDelete(c.id)} style={{ background: "none", border: "none", color: "#9C9590", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "0 4px" }}>×</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Editable hours cell with a transient saved ✓. onSave returns whether it persisted.
function HoursCell({ value, onSave }: { value: number | null; onSave: (v: number | null) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const [saved, setSaved] = useState(false)

  function start() { setDraft(value != null && value > 0 ? String(value) : ""); setEditing(true) }
  async function commit() {
    setEditing(false)
    const raw = draft.trim()
    const v = raw === "" ? null : parseFloat(raw)
    if (v != null && (isNaN(v) || v < 0)) return
    if ((v ?? null) === (value ?? null)) return
    const ok = await onSave(v)
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 1600) }
  }

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 5, justifyContent: "flex-end" }}>
      {editing ? (
        <input
          autoFocus type="number" min={0} step={0.5} value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditing(false) }}
          style={{ width: 60, padding: "5px 8px", border: "1px solid #E9532A", borderRadius: 6, fontSize: 13, textAlign: "right", fontVariantNumeric: "tabular-nums", outline: "none", background: "#FFF7ED", fontFamily: "inherit" }}
        />
      ) : (
        <button onClick={start} title="Click to edit"
          style={{ background: "none", border: "1px dashed #E0DAD0", borderRadius: 6, padding: "4px 9px", fontSize: 13, color: value != null && value > 0 ? "#1A1916" : "#C4BFB8", cursor: "pointer", fontVariantNumeric: "tabular-nums" }}>
          {value != null && value > 0 ? `${value}h` : "set"}
        </button>
      )}
      <span style={{ color: "#1F7A4D", fontSize: 13, fontWeight: 700, width: 10, opacity: saved ? 1 : 0, transition: "opacity 0.2s" }}>✓</span>
    </div>
  )
}

function HourlyYieldTable({ contracts, accounts, minHourlyRate, onHoursChange }: {
  contracts: Contract[]
  accounts: Account[]
  minHourlyRate: number | null
  onHoursChange: (id: string, hours: number) => Promise<boolean>
}) {
  const fmtCurrency = useFmtCurrency()

  const nameFor = (c: Contract) => c.accountId ? accounts.find(a => a.id === c.accountId)?.name ?? null : null
  const hasMin = minHourlyRate != null && minHourlyRate > 0

  const retainers = contracts
    .filter(c => c.status === "active" && c.type !== "oneoff")
    .map(c => ({ c, accountName: nameFor(c), perHr: c.hoursPerMonth > 0 ? c.monthly / c.hoursPerMonth : null }))
    .sort((a, b) => (b.perHr ?? -1) - (a.perHr ?? -1))

  const oneoffs = contracts
    .filter(c => c.type === "oneoff" && (c.status === "active" || c.status === "finished"))
    .map(c => ({ c, accountName: nameFor(c), perHr: c.hoursPerMonth > 0 ? c.monthly / c.hoursPerMonth : null }))
    .sort((a, b) => (b.perHr ?? -1) - (a.perHr ?? -1))

  const totalMonthly = retainers.reduce((s, r) => s + (r.perHr != null ? r.c.monthly : 0), 0)
  const totalHours = retainers.reduce((s, r) => s + (r.perHr != null ? r.c.hoursPerMonth : 0), 0)
  const blended = totalHours > 0 ? totalMonthly / totalHours : null

  function RatePerHr({ v }: { v: number | null }) {
    if (v == null) return <span style={{ color: "#C4BFB8", fontWeight: 700 }}>—</span>
    const color = hasMin ? (v >= (minHourlyRate as number) ? "#1F7A4D" : "#C2410C") : "#1A1916"
    return (
      <span style={{ color, fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
        {hasMin && <span style={{ fontSize: 10 }}>{v >= (minHourlyRate as number) ? "▲" : "▼"} </span>}
        {fmtCurrency(v)}
      </span>
    )
  }

  if (retainers.length === 0 && oneoffs.length === 0) {
    return <div style={{ fontSize: 12, color: "#9C9590", padding: "8px 0" }}>No active projects to measure yet.</div>
  }

  const th: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "#9C9590", padding: "6px 10px", borderBottom: "1px solid #ECE7DE", whiteSpace: "nowrap" }
  const sectionLabel: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: "#9C9590", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, marginTop: 18 }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, color: "#9C9590" }}>Click hrs to set your real numbers · {hasMin ? "▲ above / ▼ below your minimum" : "set a minimum $/hr in Settings to flag projects"}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {blended != null && <div style={{ fontSize: 12, color: "#6B6760" }}>Blended <strong style={{ color: "#1A1916", fontVariantNumeric: "tabular-nums" }}>{fmtCurrency(blended)}/hr</strong></div>}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }} title="Set in Settings">
            <span style={{ fontSize: 11, color: "#9C9590", fontWeight: 600, whiteSpace: "nowrap" }}>Min $/hr</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: hasMin ? "#1A1916" : "#C4BFB8", fontVariantNumeric: "tabular-nums" }}>
              {hasMin ? fmtCurrency(minHourlyRate as number) : "not set"}
            </span>
          </div>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        {retainers.length > 0 && (
          <>
            {oneoffs.length > 0 && <div style={sectionLabel}>Retainers</div>}
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 460 }}>
              <thead>
                <tr>
                  {["Project", "Client", "Monthly", "Hrs / mo", "$ / hr"].map((h, i) => (
                    <th key={h} style={{ ...th, textAlign: i >= 2 ? "right" : "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {retainers.map(({ c, accountName, perHr }) => (
                  <tr key={c.id} style={{ borderBottom: "1px solid #F5F1EC" }}>
                    <td style={{ padding: "8px 10px", fontSize: 13, color: "#1A1916", fontWeight: 500, whiteSpace: "nowrap" }}>{c.name}</td>
                    <td style={{ padding: "8px 10px", fontSize: 12, color: accountName ? "#6B6760" : "#C2410C", whiteSpace: "nowrap" }}>{accountName ?? "Unassigned"}</td>
                    <td style={{ padding: "8px 10px", fontSize: 13, color: "#1A1916", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtCurrency(c.monthly)}</td>
                    <td style={{ padding: "4px 10px", textAlign: "right" }}>
                      <HoursCell value={c.hoursPerMonth} onSave={v => onHoursChange(c.id, v ?? 0)} />
                    </td>
                    <td style={{ padding: "8px 10px", fontSize: 14, textAlign: "right" }}><RatePerHr v={perHr} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {oneoffs.length > 0 && (
          <>
            <div style={sectionLabel}>One-offs</div>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 460 }}>
              <thead>
                <tr>
                  {["Project", "Client", "Value", "Hours", "$ / hr"].map((h, i) => (
                    <th key={h} style={{ ...th, textAlign: i >= 2 ? "right" : "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {oneoffs.map(({ c, accountName, perHr }) => (
                  <tr key={c.id} style={{ borderBottom: "1px solid #F5F1EC" }}>
                    <td style={{ padding: "8px 10px", fontSize: 13, color: "#1A1916", fontWeight: 500, whiteSpace: "nowrap" }}>{c.name}</td>
                    <td style={{ padding: "8px 10px", fontSize: 12, color: accountName ? "#6B6760" : "#C2410C", whiteSpace: "nowrap" }}>{accountName ?? "Unassigned"}</td>
                    <td style={{ padding: "8px 10px", fontSize: 13, color: "#1A1916", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtCurrency(c.monthly)}</td>
                    <td style={{ padding: "4px 10px", textAlign: "right" }}>
                      <HoursCell value={c.hoursPerMonth} onSave={v => onHoursChange(c.id, v ?? 0)} />
                    </td>
                    <td style={{ padding: "8px 10px", fontSize: 14, textAlign: "right" }}><RatePerHr v={perHr} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  )
}

function ContractGantt({ contracts, accounts, now, showAll, onToggleShowAll }: { contracts: Contract[]; accounts: Account[]; now: string; showAll: boolean; onToggleShowAll: () => void }) {
  if (!contracts.length) return null

  const allYMs = contracts.flatMap(c => [c.start, ...(c.contractedThrough ? [c.contractedThrough] : [])])
  allYMs.push(now)
  // Window: 12 months back through 12 months forward runway. History is trimmed
  // (bars clamp to the left edge) and the runway is capped at 12 months out.
  const twelveAgo = ymAdd(now, -11)
  const forwardCap = ymAdd(now, 12)
  const rawMin = allYMs.reduce((a, b) => a < b ? a : b)
  const minYM = rawMin < twelveAgo ? twelveAgo : rawMin
  const hasOngoing = contracts.some(c => !c.contractedThrough)
  const rawMax = allYMs.reduce((a, b) => a > b ? a : b)
  const extendedMax = hasOngoing ? ymAdd(rawMax, 6) : rawMax
  const maxYM = extendedMax > forwardCap ? forwardCap : extendedMax

  const toMonths = (ym: string) => {
    const [y, m] = ym.split("-").map(Number)
    return y * 12 + m
  }

  const startMo = toMonths(minYM)
  const endMo = toMonths(maxYM)
  const totalMo = endMo - startMo + 1

  if (totalMo <= 0) return null

  // Only rows that overlap the visible window.
  const visible = contracts.filter(c => toMonths(c.contractedThrough ?? maxYM) >= startMo && toMonths(c.start) <= endMo)

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  const moToLabel = (mo: number) => {
    const adj = mo - 1
    const year = Math.floor(adj / 12)
    const month = (adj % 12) + 1
    return `${MONTHS[month - 1]} '${String(year).slice(2)}`
  }

  const step = totalMo <= 12 ? 1 : totalMo <= 24 ? 2 : totalMo <= 48 ? 3 : 6
  const axisTicks: number[] = []
  for (let mo = startMo; mo <= endMo; mo++) {
    if ((mo - startMo) % step === 0) axisTicks.push(mo)
  }

  const ganttColor: Record<string, string> = { active: "#E9532A", potential: "#F5C4B4", finished: "#D1D5DB" }
  const AXIS_H = 18
  const BAR_H = 16
  const ROW_H = 24

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ fontSize: 10, color: "#9C9590", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Account Runway</div>
        <button onClick={onToggleShowAll} style={{ background: "none", border: "none", fontSize: 10, color: "#9C9590", cursor: "pointer", padding: 0, textDecoration: "underline" }}>
          {showAll ? "Active only" : "Show all"}
        </button>
      </div>
      <div style={{ position: "relative", height: AXIS_H + visible.length * ROW_H + 8 }}>
        {/* Month axis */}
        {axisTicks.map(mo => (
          <div key={mo} style={{ position: "absolute", top: 0, left: `${((mo - startMo) / totalMo) * 100}%`, transform: "translateX(-50%)", textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "#B0A9A0", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", lineHeight: 1, marginBottom: 2 }}>{moToLabel(mo)}</div>
            <div style={{ width: 1, height: 3, background: "#D1CCC5", margin: "0 auto" }} />
          </div>
        ))}
        {visible.map((c, i) => {
          const isOngoing = !c.contractedThrough
          const effectiveThrough = c.contractedThrough ?? maxYM
          const barStartMo = Math.max(toMonths(c.start), startMo)
          const barEndMo = Math.min(toMonths(effectiveThrough), endMo)
          const clippedLeft = toMonths(c.start) < startMo
          const clippedRight = toMonths(effectiveThrough) > endMo // ends beyond the 12-month window
          const left = ((barStartMo - startMo) / totalMo) * 100
          const width = ((barEndMo - barStartMo + 1) / totalMo) * 100
          const accountName = c.accountId ? accounts.find(a => a.id === c.accountId)?.name : null
          const label = accountName ? `${c.name} - ${accountName}` : c.name
          return (
            <div key={c.id} style={{
              position: "absolute", top: AXIS_H + i * ROW_H + 4, left: `${left}%`, width: `${width}%`,
              height: BAR_H, background: ganttColor[c.status] ?? "#F5C4B4",
              borderRadius: `${clippedLeft ? "0" : "4px"} ${isOngoing || clippedRight ? "0" : "4px"} ${isOngoing || clippedRight ? "0" : "4px"} ${clippedLeft ? "0" : "4px"}`, opacity: 0.85, display: "flex", alignItems: "center",
              paddingLeft: 6, overflow: "hidden",
            }}>
              <span style={{ fontSize: 9, color: "#fff", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }} title={label}>{label}</span>
              {(isOngoing || clippedRight) && <span style={{ fontSize: 10, color: "#fff", fontWeight: 700, paddingRight: 4, flexShrink: 0 }}>→</span>}
            </div>
          )
        })}
        <div style={{
          position: "absolute", top: 0,
          left: `${((toMonths(now) - startMo) / totalMo) * 100}%`,
          width: 1, height: AXIS_H + visible.length * ROW_H + 8, background: "#1A1916", opacity: 0.2,
        }} />
      </div>
    </div>
  )
}
