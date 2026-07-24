"use client"
import { useState } from "react"
import { fmtCurrency, ymLabel } from "@/lib/calc"

interface Account {
  id: string
  name: string
  contactName?: string | null
  contactEmail?: string | null
  notes?: string | null
}

interface Contract {
  id: string
  name: string
  monthly: number
  start: string
  contractedThrough: string | null
  status: string
  type: string
  accountId?: string | null
}

type ContractStatus = "potential" | "active" | "finished"
type ContractType = "retainer" | "ongoing" | "oneoff"

interface Product {
  id: string
  name: string
  type: string
  monthly: number
}

interface Props {
  clientId: string
  initialAccounts: Account[]
  contracts: Contract[]
  products?: Product[]
  onAccountsChange: (accounts: Account[]) => void
  onContractAccountChange: (contractId: string, accountId: string | null) => void
  onContractCreated?: (contract: Contract) => void
}

const now = new Date().toISOString().slice(0, 7)
const defaultProjectForm = { name: "", type: "retainer" as ContractType, monthly: "", status: "active" as ContractStatus, start: now, contractedThrough: "" }

const inputStyle: React.CSSProperties = {
  padding: "7px 10px", border: "1px solid #ECE7DE", borderRadius: 6,
  fontSize: 13, background: "#fff", color: "#1A1916",
  width: "100%", boxSizing: "border-box", fontFamily: "inherit", outline: "none",
}
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "#6B6760", display: "block", marginBottom: 4 }

const now2 = new Date().toISOString().slice(0, 7)

function normalizeType(raw: string): ContractType {
  const s = raw.toLowerCase().trim()
  if (s === "oneoff" || s === "one-off" || s === "one off" || s === "o") return "oneoff"
  if (s === "ongoing" || s === "retainer-ongoing" || s === "retainer ongoing") return "ongoing"
  return "retainer"
}

function normalizeStatus(raw: string): ContractStatus {
  const s = raw.toLowerCase().trim()
  if (s === "potential" || s === "p") return "potential"
  if (s === "finished" || s === "f" || s === "done" || s === "ended") return "finished"
  return "active"
}

function normalizeMonth(raw: string): string {
  if (!raw) return ""
  const s = raw.trim()
  if (/^\d{4}-\d{2}$/.test(s)) return s
  const mmyyyy = s.match(/^(\d{1,2})\/(\d{4})$/)
  if (mmyyyy) return `${mmyyyy[2]}-${mmyyyy[1].padStart(2, "0")}`
  return ""
}

interface ParsedRow {
  accountName: string
  projectName: string
  type: ContractType
  monthly: number
  status: ContractStatus
  start: string
  contractedThrough: string | null
  errors: string[]
}

function parseBulk(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (!lines.length) return []
  const first = lines[0].split(/\t/).map(s => s.trim().toLowerCase())
  const startIdx = first[0] === "account" || first[0] === "account name" ? 1 : 0
  return lines.slice(startIdx).map(line => {
    const cols = line.split(/\t/).map(s => s.trim())
    const [rawAccount = "", rawProject = "", rawType = "", rawMonthly = "", col4 = "", col5 = "", col6 = ""] = cols
    // Status is optional — detect by checking if col4 looks like a date
    const statusSkipped = !!normalizeMonth(col4)
    const rawStatus = statusSkipped ? "" : col4
    const rawStart = statusSkipped ? col4 : col5
    const rawThrough = statusSkipped ? col5 : col6
    const errors: string[] = []
    if (!rawAccount) errors.push("Account required")
    if (!rawProject) errors.push("Project name required")
    const type = normalizeType(rawType)
    const status = normalizeStatus(rawStatus)
    const monthlyNum = parseFloat(rawMonthly.replace(/[$,\s]/g, ""))
    if (isNaN(monthlyNum) || monthlyNum < 0) errors.push("Invalid amount")
    const start = normalizeMonth(rawStart) || now2
    if (rawStart && !normalizeMonth(rawStart)) errors.push("Invalid start (use YYYY-MM)")
    const throughRaw = normalizeMonth(rawThrough)
    const contractedThrough = type === "oneoff" ? start : type === "ongoing" ? null : (throughRaw || null)
    if (type === "retainer" && !throughRaw) errors.push("Through date required for Retainer – End Date")
    return { accountName: rawAccount, projectName: rawProject, type, monthly: isNaN(monthlyNum) ? 0 : monthlyNum, status, start, contractedThrough, errors }
  })
}

function BulkImportModal({ clientId, onClose, onImport }: { clientId: string; onClose: () => void; onImport: (accounts: Account[], contracts: Contract[]) => void }) {
  const [text, setText] = useState("")
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rows = text.trim() ? parseBulk(text) : []
  const overLimit = rows.length > 200
  const valid = rows.filter(r => r.errors.length === 0).slice(0, 200)

  async function handleImport() {
    if (!valid.length) return
    setImporting(true)
    setError(null)
    const res = await fetch(`/api/clients/${clientId}/accounts/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(valid.map(r => ({
        accountName: r.accountName,
        projectName: r.projectName,
        type: r.type,
        monthly: r.monthly,
        status: r.status,
        start: r.start,
        contractedThrough: r.contractedThrough,
      }))),
    })
    setImporting(false)
    if (!res.ok) { setError("Import failed — check your data and try again"); return }
    const { accounts, contracts } = await res.json()
    onImport(accounts, contracts)
    onClose()
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: "#fff", borderRadius: 14, padding: 28, width: "min(680px, 100%)", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <h2 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 22, fontWeight: 600, margin: "0 0 4px", color: "#1A1916" }}>Bulk Import Accounts & Projects</h2>
          <p style={{ fontSize: 12, color: "#9C9590", margin: 0 }}>
            Paste from a spreadsheet — columns in order: <strong>Account · Project Name · Type · Monthly · Status · Start · Through</strong>
            <br />Multiple rows with the same Account name create one account with multiple projects.
            <br />Type: <code>retainer</code> (needs Through), <code>ongoing</code> (no Through), <code>oneoff</code> &nbsp;·&nbsp; Status: active, potential, finished &nbsp;·&nbsp; Dates: YYYY-MM
          </p>
        </div>
        <textarea
          autoFocus
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={"Acme Marketing\tSEO Retainer\tretainer\t2500\tactive\t2026-01\t2026-12\nAcme Marketing\tContent Strategy\tongoing\t1500\tactive\t2026-01\nBlue Goose Creative\tWebsite Redesign\toneoff\t8500\tactive\t2026-03"}
          style={{ width: "100%", height: 120, padding: "10px 12px", border: "1px solid #ECE7DE", borderRadius: 8, fontSize: 12, fontFamily: "monospace", resize: "vertical", boxSizing: "border-box", outline: "none", color: "#1A1916" }}
        />
        {rows.length > 0 && (
          <div style={{ overflowX: "auto", border: "1px solid #ECE7DE", borderRadius: 8 }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#FBFAF7" }}>
                  {["Account", "Project", "Type", "Monthly", "Status", "Start", "Through", ""].map(h => (
                    <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontWeight: 600, color: "#9C9590", fontSize: 11, borderBottom: "1px solid #ECE7DE", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} style={{ background: row.errors.length ? "#FFF5F5" : "transparent" }}>
                    <td style={{ padding: "6px 10px", borderBottom: "1px solid #F5F1EC", color: "#1A1916", fontWeight: 500 }}>
                      {row.accountName || <em style={{ color: "#C2410C" }}>missing</em>}
                    </td>
                    <td style={{ padding: "6px 10px", borderBottom: "1px solid #F5F1EC", color: "#1A1916" }}>
                      {row.projectName || <em style={{ color: "#C2410C" }}>missing</em>}
                    </td>
                    <td style={{ padding: "6px 10px", borderBottom: "1px solid #F5F1EC", color: "#6B6760" }}>{row.type}</td>
                    <td style={{ padding: "6px 10px", borderBottom: "1px solid #F5F1EC", fontVariantNumeric: "tabular-nums" }}>{isNaN(row.monthly) ? <span style={{ color: "#C2410C" }}>?</span> : fmtCurrency(row.monthly)}</td>
                    <td style={{ padding: "6px 10px", borderBottom: "1px solid #F5F1EC" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: row.status === "active" ? "#166534" : row.status === "potential" ? "#92400E" : "#6B7280" }}>{row.status}</span>
                    </td>
                    <td style={{ padding: "6px 10px", borderBottom: "1px solid #F5F1EC", color: "#6B6760", fontVariantNumeric: "tabular-nums" }}>{row.start}</td>
                    <td style={{ padding: "6px 10px", borderBottom: "1px solid #F5F1EC", color: "#6B6760", fontVariantNumeric: "tabular-nums" }}>{row.contractedThrough ?? "—"}</td>
                    <td style={{ padding: "6px 10px", borderBottom: "1px solid #F5F1EC" }}>
                      {row.errors.length ? <span style={{ color: "#C2410C", fontSize: 11 }}>⚠ {row.errors.join(", ")}</span> : <span style={{ color: "#166534" }}>✓</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {overLimit && (
          <div style={{ fontSize: 12, color: "#C2410C", background: "#FFF5F5", border: "1px solid #FECACA", borderRadius: 6, padding: "8px 12px" }}>
            Only the first 200 rows will be imported. Remove {rows.length - 200} row{rows.length - 200 !== 1 ? "s" : ""} or split into multiple imports.
          </div>
        )}
        {error && <div style={{ fontSize: 13, color: "#C2410C" }}>{error}</div>}
        <div style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 12, color: "#9C9590" }}>
            {rows.length > 0 && (
              valid.length === rows.length
                ? `${rows.length} row${rows.length !== 1 ? "s" : ""} ready to import`
                : `${valid.length} of ${Math.min(rows.length, 200)} rows valid — fix errors to include them`
            )}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={onClose}
              style={{ padding: "8px 16px", background: "none", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 13, cursor: "pointer", color: "#6B6760" }}>
              Cancel
            </button>
            <button onClick={handleImport} disabled={importing || valid.length === 0}
              style={{ padding: "8px 18px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: importing || valid.length === 0 ? "default" : "pointer", opacity: importing || valid.length === 0 ? 0.5 : 1 }}>
              {importing ? "Importing…" : `Import ${valid.length} row${valid.length !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AccountsPanel({ clientId, initialAccounts, contracts, products, onAccountsChange, onContractAccountChange, onContractCreated }: Props) {
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: "", contactName: "", contactEmail: "" })
  const [saving, setSaving] = useState(false)
  const [assigningContract, setAssigningContract] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: "", contactName: "", contactEmail: "" })
  const [editSaving, setEditSaving] = useState(false)
  const [addingProjectForAccount, setAddingProjectForAccount] = useState<string | null>(null)
  const [projectForm, setProjectForm] = useState(defaultProjectForm)
  const [projectSaving, setProjectSaving] = useState(false)

  function updateAccounts(next: Account[]) {
    setAccounts(next)
    onAccountsChange(next)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    const res = await fetch(`/api/clients/${clientId}/accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        contactName: form.contactName.trim() || undefined,
        contactEmail: form.contactEmail.trim() || undefined,
      }),
    })
    setSaving(false)
    if (!res.ok) return
    const created: Account = await res.json()
    updateAccounts([...accounts, created].sort((a, b) => a.name.localeCompare(b.name)))
    setForm({ name: "", contactName: "", contactEmail: "" })
    setAdding(false)
  }

  async function handleAssign(contractId: string, accountId: string | null) {
    await fetch(`/api/contracts/${contractId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId }),
    })
    onContractAccountChange(contractId, accountId)
    setAssigningContract(null)
  }

  function startEdit(account: Account) {
    setEditingId(account.id)
    setEditForm({ name: account.name, contactName: account.contactName ?? "", contactEmail: account.contactEmail ?? "" })
  }

  async function handleEditSave(e: React.FormEvent, accountId: string) {
    e.preventDefault()
    setEditSaving(true)
    const res = await fetch(`/api/clients/${clientId}/accounts/${accountId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editForm.name.trim(),
        contactName: editForm.contactName.trim() || null,
        contactEmail: editForm.contactEmail.trim() || null,
      }),
    })
    setEditSaving(false)
    if (!res.ok) return
    const updated: Account = await res.json()
    updateAccounts(accounts.map(a => a.id === accountId ? updated : a))
    setEditingId(null)
  }

  async function handleDelete(accountId: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    await fetch(`/api/clients/${clientId}/accounts/${accountId}`, { method: "DELETE" })
    updateAccounts(accounts.filter(a => a.id !== accountId))
  }

  async function handleAddProject(e: React.FormEvent, accountId: string) {
    e.preventDefault()
    setProjectSaving(true)
    const isOngoing = projectForm.type === "ongoing"
    const res = await fetch(`/api/clients/${clientId}/contracts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: projectForm.name.trim(),
        type: isOngoing ? "retainer" : projectForm.type,
        monthly: parseFloat(projectForm.monthly),
        status: projectForm.status,
        start: projectForm.start,
        contractedThrough: isOngoing ? null : projectForm.type === "oneoff" ? projectForm.start : projectForm.contractedThrough || null,
        accountId,
      }),
    })
    setProjectSaving(false)
    if (!res.ok) return
    const contract: Contract = await res.json()
    onContractCreated?.(contract)
    setAddingProjectForAccount(null)
    setProjectForm(defaultProjectForm)
  }

  const byAccount = new Map<string | null, Contract[]>()
  for (const c of contracts) {
    const key = c.accountId ?? null
    byAccount.set(key, [...(byAccount.get(key) ?? []), c])
  }

  const assignSelect = (contractId: string, currentAccountId: string | null) => (
    <select
      autoFocus
      defaultValue={currentAccountId ?? ""}
      onBlur={e => handleAssign(contractId, e.target.value || null)}
      onChange={e => handleAssign(contractId, e.target.value || null)}
      style={{ fontSize: 11, border: "1px solid #ECE7DE", borderRadius: 4, padding: "2px 6px", color: "#1A1916", background: "#fff", outline: "none" }}
    >
      <option value="">— Unassign —</option>
      {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
    </select>
  )

  return (
    <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 20 }}>
      {bulkOpen && (
        <BulkImportModal
          clientId={clientId}
          onClose={() => setBulkOpen(false)}
          onImport={(newAccounts, newContracts) => {
            updateAccounts([...accounts, ...newAccounts].sort((a, b) => a.name.localeCompare(b.name)))
            newContracts.forEach(c => onContractCreated?.(c))
          }}
        />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1916" }}>Client Accounts</div>
          <div style={{ fontSize: 11, color: "#9C9590", marginTop: 2 }}>{accounts.length} account{accounts.length !== 1 ? "s" : ""} · assign projects to group them</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setBulkOpen(true)}
            style={{ padding: "6px 14px", background: "none", color: "#6B6760", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            Bulk Import
          </button>
          <button onClick={() => setAdding(a => !a)}
            style={{ padding: "6px 14px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            + Add Account
          </button>
        </div>
      </div>

      {adding && (
        <form onSubmit={handleAdd} style={{ background: "#FBFAF7", border: "1px solid #ECE7DE", borderRadius: 8, padding: 14, marginBottom: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div>
              <label style={labelStyle}>Account Name</label>
              <input style={{ ...inputStyle, background: "#fff" }} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Acme Marketing" required autoFocus />
            </div>
            <div>
              <label style={labelStyle}>Contact Name</label>
              <input style={{ ...inputStyle, background: "#fff" }} value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} placeholder="Jim McDannald" />
            </div>
            <div>
              <label style={labelStyle}>Contact Email</label>
              <input style={{ ...inputStyle, background: "#fff" }} type="email" value={form.contactEmail} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} placeholder="jim@acme.com" />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setAdding(false)}
              style={{ padding: "6px 14px", background: "none", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 12, cursor: "pointer", color: "#6B6760" }}>
              Cancel
            </button>
            <button type="submit" disabled={saving}
              style={{ padding: "6px 16px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      )}

      {accounts.length === 0 ? (
        <div style={{ color: "#9C9590", fontSize: 13, padding: "24px 0", textAlign: "center" }}>
          No accounts yet. Add one above or bulk import.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {accounts.map(account => {
            const accountContracts = byAccount.get(account.id) ?? []
            const isEditing = editingId === account.id
            return (
              <div key={account.id} style={{ border: "1px solid #F5F1EC", borderRadius: 8, overflow: "hidden" }}>
                {isEditing ? (
                  <form onSubmit={e => handleEditSave(e, account.id)} style={{ padding: "10px 14px", background: "#FBFAF7", display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                      <div>
                        <label style={labelStyle}>Account Name</label>
                        <input style={{ ...inputStyle, fontSize: 12 }} value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} required autoFocus />
                      </div>
                      <div>
                        <label style={labelStyle}>Contact Name</label>
                        <input style={{ ...inputStyle, fontSize: 12 }} value={editForm.contactName} onChange={e => setEditForm(f => ({ ...f, contactName: e.target.value }))} />
                      </div>
                      <div>
                        <label style={labelStyle}>Contact Email</label>
                        <input style={{ ...inputStyle, fontSize: 12 }} type="email" value={editForm.contactEmail} onChange={e => setEditForm(f => ({ ...f, contactEmail: e.target.value }))} />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button type="button" onClick={() => setEditingId(null)}
                        style={{ padding: "4px 12px", background: "none", border: "1px solid #ECE7DE", borderRadius: 5, fontSize: 12, cursor: "pointer", color: "#6B6760" }}>
                        Cancel
                      </button>
                      <button type="submit" disabled={editSaving}
                        style={{ padding: "4px 12px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                        {editSaving ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </form>
                ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#FBFAF7" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1916" }}>{account.name}</div>
                    {(account.contactName || account.contactEmail) && (
                      <div style={{ fontSize: 11, color: "#9C9590", marginTop: 2 }}>
                        {account.contactName}
                        {account.contactName && account.contactEmail && " · "}
                        {account.contactEmail && (
                          <a href={`mailto:${account.contactEmail}`} style={{ color: "#9C9590" }}>{account.contactEmail}</a>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "#9C9590" }}>
                    {accountContracts.length} project{accountContracts.length !== 1 ? "s" : ""}
                  </div>
                  <button onClick={() => { setAddingProjectForAccount(a => a === account.id ? null : account.id); setProjectForm(defaultProjectForm) }}
                    style={{ background: "none", border: "1px solid #E9532A", borderRadius: 4, fontSize: 11, color: "#E9532A", cursor: "pointer", padding: "2px 8px", fontWeight: 600 }}>
                    + Project
                  </button>
                  <button onClick={() => startEdit(account)}
                    style={{ background: "none", border: "1px solid #ECE7DE", borderRadius: 4, fontSize: 11, color: "#6B6760", cursor: "pointer", padding: "2px 8px" }}>
                    Edit
                  </button>
                  <button onClick={() => handleDelete(account.id, account.name)}
                    style={{ background: "none", border: "none", color: "#9C9590", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 2px" }}>
                    ×
                  </button>
                </div>
                )}
                {!isEditing && addingProjectForAccount === account.id && (
                  <form onSubmit={e => handleAddProject(e, account.id)} style={{ padding: "10px 14px", borderTop: "1px solid #F5F1EC", background: "#FDFCFA", display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 8, borderBottom: "1px solid #F0EDE8" }}>
                      <span style={{ fontSize: 11, color: "#9C9590", fontWeight: 600, whiteSpace: "nowrap" }}>Product:</span>
                      {products && products.length > 0 ? (
                        <select
                          style={{ fontSize: 12, border: "1px solid #ECE7DE", borderRadius: 5, padding: "3px 8px", color: "#1A1916", background: "#fff", outline: "none", cursor: "pointer" }}
                          value=""
                          onChange={e => {
                            const p = products.find(p => p.id === e.target.value)
                            if (p) setProjectForm(f => ({ ...f, name: p.name, type: p.type as ContractType, monthly: String(p.monthly) }))
                          }}
                        >
                          <option value="">— Select to pre-fill —</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      ) : (
                        <span style={{ fontSize: 11, color: "#C2956C" }}>No products yet — add them in the <strong>Products</strong> tab first.</span>
                      )}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 8 }}>
                      <div>
                        <label style={labelStyle}>Project Name</label>
                        <input style={{ ...inputStyle, fontSize: 12 }} value={projectForm.name} onChange={e => setProjectForm(f => ({ ...f, name: e.target.value }))} required autoFocus placeholder="Retainer" />
                      </div>
                      <div>
                        <label style={labelStyle}>Type</label>
                        <select style={{ ...inputStyle, fontSize: 12 }} value={projectForm.type} onChange={e => setProjectForm(f => ({ ...f, type: e.target.value as ContractType }))}>
                          <option value="retainer">Retainer – End Date</option>
                          <option value="ongoing">Retainer – Ongoing</option>
                          <option value="oneoff">One-off</option>
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>{projectForm.type === "oneoff" ? "Amount ($)" : "Monthly ($)"}</label>
                        <input style={{ ...inputStyle, fontSize: 12 }} type="number" value={projectForm.monthly} onChange={e => setProjectForm(f => ({ ...f, monthly: e.target.value }))} required placeholder="2500" min={0} />
                      </div>
                      <div>
                        <label style={labelStyle}>Status</label>
                        <select style={{ ...inputStyle, fontSize: 12 }} value={projectForm.status} onChange={e => setProjectForm(f => ({ ...f, status: e.target.value as ContractStatus }))}>
                          <option value="potential">Potential</option>
                          <option value="active">Active</option>
                          <option value="finished">Finished</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                      <div>
                        <label style={labelStyle}>{projectForm.type === "oneoff" ? "Month" : "Start"}</label>
                        <input style={{ ...inputStyle, fontSize: 12, width: 140 }} type="month" value={projectForm.start} onChange={e => setProjectForm(f => ({ ...f, start: e.target.value, ...(f.type === "oneoff" ? { contractedThrough: e.target.value } : {}) }))} required />
                      </div>
                      {projectForm.type === "retainer" && (
                        <div>
                          <label style={labelStyle}>Through</label>
                          <input style={{ ...inputStyle, fontSize: 12, width: 140 }} type="month" value={projectForm.contractedThrough} onChange={e => setProjectForm(f => ({ ...f, contractedThrough: e.target.value }))} required />
                        </div>
                      )}
                      {projectForm.type === "ongoing" && (
                        <div style={{ fontSize: 11, color: "#9C9590", alignSelf: "flex-end", paddingBottom: 8 }}>No end date</div>
                      )}
                      <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                        <button type="button" onClick={() => setAddingProjectForAccount(null)}
                          style={{ padding: "6px 12px", background: "none", border: "1px solid #ECE7DE", borderRadius: 5, fontSize: 12, cursor: "pointer", color: "#6B6760" }}>
                          Cancel
                        </button>
                        <button type="submit" disabled={projectSaving}
                          style={{ padding: "6px 14px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                          {projectSaving ? "Saving…" : "Add Project"}
                        </button>
                      </div>
                    </div>
                  </form>
                )}
                {!isEditing && accountContracts.length > 0 && (
                  <div style={{ padding: "6px 14px 10px" }}>
                    {accountContracts.map(c => (
                      <div key={c.id} style={{ fontSize: 12, color: "#6B6760", padding: "4px 0", borderBottom: "1px solid #F5F1EC", display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 500, color: "#1A1916" }}>{c.name}</span>
                        <span style={{ color: "#9C9590" }}>
                          {c.type === "oneoff"
                            ? ymLabel(c.start)
                            : c.contractedThrough
                            ? `${ymLabel(c.start)} – ${ymLabel(c.contractedThrough)}`
                            : `${ymLabel(c.start)} – Ongoing`}
                        </span>
                        <span style={{ color: "#9C9590" }}>·</span>
                        <span style={{ fontVariantNumeric: "tabular-nums", color: "#6B6760" }}>
                          {fmtCurrency(c.monthly)}{c.type === "retainer" ? "/mo" : ""}
                        </span>
                        <span style={{ flex: 1 }} />
                        {assigningContract === c.id
                          ? assignSelect(c.id, c.accountId ?? null)
                          : <button onClick={() => setAssigningContract(c.id)}
                              style={{ background: "none", border: "1px solid #ECE7DE", borderRadius: 4, fontSize: 11, color: "#9C9590", cursor: "pointer", padding: "2px 8px" }}>
                              Reassign
                            </button>
                        }
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {(byAccount.get(null) ?? []).length > 0 && (
            <div style={{ border: "1px dashed #ECE7DE", borderRadius: 8, overflow: "hidden", marginTop: 4 }}>
              <div style={{ padding: "8px 14px", background: "#FAFAF9" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#9C9590", textTransform: "uppercase", letterSpacing: "0.05em" }}>Unassigned Projects</div>
              </div>
              <div style={{ padding: "4px 14px 10px" }}>
                {(byAccount.get(null) ?? []).map(c => (
                  <div key={c.id} style={{ fontSize: 12, color: "#6B6760", padding: "4px 0", borderBottom: "1px solid #F5F1EC", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ flex: 1 }}>{c.name}</span>
                    {assigningContract === c.id
                      ? assignSelect(c.id, null)
                      : <button onClick={() => setAssigningContract(c.id)}
                          style={{ background: "#E9532A", border: "none", borderRadius: 4, fontSize: 11, color: "#fff", cursor: "pointer", padding: "3px 10px", fontWeight: 600 }}>
                          Assign
                        </button>
                    }
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
