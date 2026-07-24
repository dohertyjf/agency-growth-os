"use client"
import { useState } from "react"
import { fmtCurrency, ymLabel, ymAdd, bookedAhead, currentMRR, type ContractRow } from "@/lib/calc"

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

interface Account {
  id: string
  name: string
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
  onContractsChange?: (contracts: Contract[]) => void
  onAccountCreated?: (account: Account) => void
}

type ContractStatus = "potential" | "active" | "finished"

const STATUS_LABELS: Record<ContractStatus, string> = { potential: "Potential", active: "Active", finished: "Finished" }
const STATUS_COLORS: Record<ContractStatus, { bg: string; text: string }> = {
  potential: { bg: "#FFF7ED", text: "#92400E" },
  active: { bg: "#DCFCE7", text: "#166534" },
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

// ── Bulk import ───────────────────────────────────────────────────────────────

interface ParsedRow {
  name: string
  type: ContractTypeField
  monthly: number
  status: ContractStatus
  start: string
  contractedThrough: string | null
  errors: string[]
}

const now2 = new Date().toISOString().slice(0, 7)

function normalizeType(raw: string): ContractTypeField {
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
  // MM/YYYY
  const mmyyyy = s.match(/^(\d{1,2})\/(\d{4})$/)
  if (mmyyyy) return `${mmyyyy[2]}-${mmyyyy[1].padStart(2, "0")}`
  return ""
}

function parsePaste(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (!lines.length) return []

  // Skip header row
  const first = lines[0].split(/\t/).map(s => s.trim().toLowerCase())
  const startIdx = first[0] === "name" ? 1 : 0
  const dataLines = lines.slice(startIdx)

  return dataLines.map(line => {
    const cols = line.split(/\t/).map(s => s.trim())
    const [rawName = "", rawType = "", rawMonthly = "", rawStatus = "", rawStart = "", rawThrough = ""] = cols

    const errors: string[] = []
    const name = rawName.trim()
    if (!name) errors.push("Name required")

    const type = normalizeType(rawType)
    const status = normalizeStatus(rawStatus)

    const monthlyNum = parseFloat(rawMonthly.replace(/[$,\s]/g, ""))
    if (isNaN(monthlyNum) || monthlyNum < 0) errors.push("Invalid amount")

    const start = normalizeMonth(rawStart) || now2
    if (rawStart && !normalizeMonth(rawStart)) errors.push("Invalid start (use YYYY-MM)")

    const throughRaw = normalizeMonth(rawThrough)
    const contractedThrough = type === "oneoff" ? start : type === "ongoing" ? null : (throughRaw || null)
    if (type === "retainer" && !throughRaw) errors.push("Through date required for Retainer – End Date")

    return { name, type, monthly: isNaN(monthlyNum) ? 0 : monthlyNum, status, start, contractedThrough, errors }
  })
}

function BulkImportModal({ clientId, onClose, onImport }: { clientId: string; onClose: () => void; onImport: (contracts: Contract[]) => void }) {
  const [text, setText] = useState("")
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rows = text.trim() ? parsePaste(text) : []
  const validRows = rows.filter(r => r.errors.length === 0)

  async function handleImport() {
    if (!validRows.length) return
    setImporting(true)
    setError(null)
    const res = await fetch(`/api/clients/${clientId}/contracts/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validRows.map(r => ({
        name: r.name, type: r.type, monthly: r.monthly,
        status: r.status, start: r.start, contractedThrough: r.contractedThrough,
      }))),
    })
    setImporting(false)
    if (!res.ok) { setError("Import failed — check your data and try again"); return }
    const created: Contract[] = await res.json()
    onImport(created)
    onClose()
  }

  const STATUS_BADGE: Record<ContractStatus, string> = { active: "#166534", potential: "#92400E", finished: "#6B7280" }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: "#fff", borderRadius: 14, padding: 28, width: "min(720px, 100%)", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <h2 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 22, fontWeight: 600, margin: "0 0 4px", color: "#1A1916" }}>Bulk Import Accounts</h2>
          <p style={{ fontSize: 12, color: "#9C9590", margin: 0 }}>
            Paste from a spreadsheet — columns in order: <strong>Name · Type · Monthly · Status · Start · Through</strong>
            <br />Type: <code>retainer</code> (needs Through date), <code>ongoing</code> (no Through), <code>oneoff</code> &nbsp;·&nbsp; Status: active, potential, finished &nbsp;·&nbsp; Dates: YYYY-MM
          </p>
        </div>

        <textarea
          autoFocus
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={"Acme Corp\tretainer\t1500\tactive\t2026-01\t2026-12\nBeta Co\tongoing\t2000\tactive\t2026-01\nGamma Co\toneoff\t850\tactive\t2026-05"}
          style={{ width: "100%", height: 120, padding: "10px 12px", border: "1px solid #ECE7DE", borderRadius: 8, fontSize: 12, fontFamily: "monospace", resize: "vertical", boxSizing: "border-box", outline: "none", color: "#1A1916" }}
        />

        {rows.length > 0 && (
          <div style={{ overflowX: "auto", border: "1px solid #ECE7DE", borderRadius: 8 }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#FBFAF7" }}>
                  {["Name", "Type", "Monthly", "Status", "Start", "Through", ""].map(h => (
                    <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontWeight: 600, color: "#9C9590", fontSize: 11, borderBottom: "1px solid #ECE7DE", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} style={{ background: row.errors.length ? "#FFF5F5" : "transparent" }}>
                    <td style={{ padding: "6px 10px", borderBottom: "1px solid #F5F1EC", color: "#1A1916" }}>{row.name || <em style={{ color: "#C2410C" }}>missing</em>}</td>
                    <td style={{ padding: "6px 10px", borderBottom: "1px solid #F5F1EC", color: "#6B6760" }}>{row.type}</td>
                    <td style={{ padding: "6px 10px", borderBottom: "1px solid #F5F1EC", fontVariantNumeric: "tabular-nums" }}>{isNaN(row.monthly) ? <span style={{ color: "#C2410C" }}>?</span> : fmtCurrency(row.monthly)}</td>
                    <td style={{ padding: "6px 10px", borderBottom: "1px solid #F5F1EC" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: STATUS_BADGE[row.status] }}>{row.status}</span>
                    </td>
                    <td style={{ padding: "6px 10px", borderBottom: "1px solid #F5F1EC", color: "#6B6760", fontVariantNumeric: "tabular-nums" }}>{row.start}</td>
                    <td style={{ padding: "6px 10px", borderBottom: "1px solid #F5F1EC", color: "#6B6760", fontVariantNumeric: "tabular-nums" }}>{row.contractedThrough}</td>
                    <td style={{ padding: "6px 10px", borderBottom: "1px solid #F5F1EC" }}>
                      {row.errors.length
                        ? <span style={{ color: "#C2410C", fontSize: 11 }}>⚠ {row.errors.join(", ")}</span>
                        : <span style={{ color: "#166534", fontSize: 13 }}>✓</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {error && <div style={{ fontSize: 13, color: "#C2410C" }}>{error}</div>}

        <div style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 12, color: "#9C9590" }}>
            {rows.length > 0 && (
              validRows.length === rows.length
                ? `${rows.length} row${rows.length !== 1 ? "s" : ""} ready to import`
                : `${validRows.length} of ${rows.length} rows valid — fix errors above to include them`
            )}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={onClose}
              style={{ padding: "8px 16px", background: "none", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 13, cursor: "pointer", color: "#6B6760" }}>
              Cancel
            </button>
            <button onClick={handleImport} disabled={importing || validRows.length === 0}
              style={{ padding: "8px 18px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: importing || validRows.length === 0 ? "default" : "pointer", opacity: importing || validRows.length === 0 ? 0.5 : 1 }}>
              {importing ? "Importing…" : `Import ${validRows.length} Account${validRows.length !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

interface EditForm {
  name: string
  monthly: string
  start: string
  contractedThrough: string
  status: ContractStatus
  type: ContractTypeField
  accountId: string | null
}

function DuplicateModal({ contract, clientId, accounts, onClose, onSave, onAccountCreated }: { contract: Contract; clientId: string; accounts?: Account[]; onClose: () => void; onSave: (c: Contract) => void; onAccountCreated: (a: Account) => void }) {
  const uiType: ContractTypeField = !contract.contractedThrough && contract.type === "retainer" ? "ongoing" : (contract.type as ContractTypeField) ?? "retainer"
  const [form, setForm] = useState<EditForm>({
    name: "",
    monthly: String(contract.monthly),
    start: contract.start,
    contractedThrough: contract.contractedThrough ?? "",
    status: "potential" as ContractStatus,
    type: uiType,
    accountId: contract.accountId ?? null,
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
                <option value="potential">Potential</option>
                <option value="active">Active</option>
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
          <div>
            <label style={labelStyle}>{form.type === "oneoff" ? "Amount ($)" : "Monthly ($)"}</label>
            <input style={inputStyle} type="number" value={form.monthly} onChange={e => setForm(f => ({ ...f, monthly: e.target.value }))} required min={0} />
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

function EditModal({ contract, clientId, accounts, onClose, onSave, onAccountCreated }: { contract: Contract; clientId: string; accounts?: Account[]; onClose: () => void; onSave: (c: Contract) => void; onAccountCreated: (a: Account) => void }) {
  const uiType: ContractTypeField = !contract.contractedThrough && contract.type === "retainer" ? "ongoing" : (contract.type as ContractTypeField) ?? "retainer"
  const [form, setForm] = useState<EditForm>({
    name: contract.name,
    monthly: String(contract.monthly),
    start: contract.start,
    contractedThrough: contract.contractedThrough ?? "",
    status: contract.status as ContractStatus,
    type: uiType,
    accountId: contract.accountId ?? null,
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
      type: isOngoing ? "retainer" : form.type,
      contractedThrough: isOngoing ? null : form.type === "oneoff" ? form.start : form.contractedThrough || null,
      accountId: form.accountId,
    }
    const res = await fetch(`/api/contracts/${contract.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    if (!res.ok) { setError("Failed to save"); return }
    const updated = await res.json()
    onSave({ ...updated, accountId: form.accountId })
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
                <option value="potential">Potential</option>
                <option value="active">Active</option>
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
            <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div>
            <label style={labelStyle}>{form.type === "oneoff" ? "Amount ($)" : "Monthly ($)"}</label>
            <input style={inputStyle} type="number" value={form.monthly} onChange={e => setForm(f => ({ ...f, monthly: e.target.value }))} required min={0} />
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

export default function ContractsPanel({ clientId, initialContracts, accounts: accountsProp, products, onContractsChange, onAccountCreated: onAccountCreatedProp }: Props) {
  const [contracts, setContracts] = useState<Contract[]>(initialContracts)
  const [localAccounts, setLocalAccounts] = useState<Account[]>(accountsProp ?? [])
  const [adding, setAdding] = useState(false)
  const [bulkImporting, setBulkImporting] = useState(false)
  const [editingContract, setEditingContract] = useState<Contract | null>(null)
  const [duplicatingContract, setDuplicatingContract] = useState<Contract | null>(null)
  const [form, setForm] = useState({ name: "", monthly: "", start: now, contractedThrough: "", status: "potential" as ContractStatus, type: "retainer" as ContractTypeField, accountId: null as string | null })
  const [saving, setSaving] = useState(false)
  const [showPast, setShowPast] = useState(false)
  const [showAllGantt, setShowAllGantt] = useState(false)

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
      setForm({ name: "", monthly: "", start: now, contractedThrough: "", status: "potential", type: "retainer", accountId: null })
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

  function handleBulkImported(created: Contract[]) {
    updateContracts([...contracts, ...created])
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 20 }}>
      {editingContract && (
        <EditModal contract={editingContract} clientId={clientId} accounts={localAccounts} onClose={() => setEditingContract(null)} onSave={handleEdited} onAccountCreated={handleAccountCreated} />
      )}
      {duplicatingContract && (
        <DuplicateModal contract={duplicatingContract} clientId={clientId} accounts={localAccounts} onClose={() => setDuplicatingContract(null)} onSave={handleDuplicated} onAccountCreated={handleAccountCreated} />
      )}
      {bulkImporting && (
        <BulkImportModal clientId={clientId} onClose={() => setBulkImporting(false)} onImport={handleBulkImported} />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1916" }}>Projects</div>
          <div style={{ fontSize: 11, color: "#9C9590", marginTop: 2 }}>
            MRR {fmtCurrency(mrr)} · {fmtCurrency(booked)} booked ahead
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setBulkImporting(true)}
            style={{ padding: "6px 14px", background: "none", color: "#6B6760", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            Bulk Import
          </button>
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
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
            <div>
              <label style={{ fontSize: 11, color: "#9C9590", display: "block", marginBottom: 4 }}>Project Name</label>
              <input style={{ ...inputStyle, background: "#FBFAF7" }} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Jim McDannald Retainer" autoFocus />
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
              <label style={{ fontSize: 11, color: "#9C9590", display: "block", marginBottom: 4 }}>Status</label>
              <select style={{ ...inputStyle, background: "#FBFAF7" }} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as ContractStatus }))}>
                <option value="potential">Potential</option>
                <option value="active">Active</option>
                <option value="finished">Finished</option>
              </select>
            </div>
            <button type="submit" disabled={saving} style={{ padding: "6px 14px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", height: 32, alignSelf: "end" }}>
              Save
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: form.type === "retainer" ? "1fr 1fr 1fr 1fr" : "1fr 1fr 2fr", gap: 8 }}>
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
        </form>
      )}

      {contracts.length === 0 ? (
        <div style={{ color: "#9C9590", fontSize: 13 }}>No contracts yet.</div>
      ) : (
        <>
          <ContractGantt
            contracts={showAllGantt ? contracts : contracts.filter(c => c.status !== "finished")}
            now={now}
            showAll={showAllGantt}
            onToggleShowAll={() => setShowAllGantt(v => !v)}
          />

          {/* Active */}
          {byStatus.active.length > 0 && (
            <ContractSection
              title="Active"
              contracts={byStatus.active}
              onEdit={setEditingContract}
              onDelete={handleDelete}
              onDuplicate={setDuplicatingContract}
            />
          )}

          {/* Pipeline */}
          {byStatus.potential.length > 0 && (
            <ContractSection
              title="Pipeline"
              contracts={byStatus.potential}
              onEdit={setEditingContract}
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
                  onEdit={setEditingContract}
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

function ContractSection({ title, contracts, onEdit, onDelete, onDuplicate, dimmed }: {
  title: string
  contracts: Contract[]
  onEdit: (c: Contract) => void
  onDelete: (id: string) => void
  onDuplicate: (c: Contract) => void
  dimmed?: boolean
}) {
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
        return (
          <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: "1px solid #F5F1EC", opacity: dimmed ? 0.6 : 1 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#1A1916" }}>{c.name}</div>
              <div style={{ fontSize: 11, color: "#9C9590" }}>
                {isOneoff
                  ? ymLabel(c.start)
                  : c.contractedThrough
                  ? `${ymLabel(c.start)} – ${ymLabel(c.contractedThrough)}`
                  : `${ymLabel(c.start)} – Ongoing`}
              </div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1A1916", fontVariantNumeric: "tabular-nums", minWidth: 80, textAlign: "right" }}>
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
            <button onClick={() => onDuplicate(c)} style={{ background: "none", border: "1px solid #ECE7DE", borderRadius: 5, color: "#6B6760", cursor: "pointer", fontSize: 12, padding: "3px 10px" }}>
              Copy
            </button>
            <button onClick={() => onEdit(c)} style={{ background: "none", border: "1px solid #ECE7DE", borderRadius: 5, color: "#6B6760", cursor: "pointer", fontSize: 12, padding: "3px 10px" }}>
              Edit
            </button>
            <button onClick={() => onDelete(c.id)} style={{ background: "none", border: "none", color: "#9C9590", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "0 4px" }}>×</button>
          </div>
        )
      })}
    </div>
  )
}

function ContractGantt({ contracts, now, showAll, onToggleShowAll }: { contracts: Contract[]; now: string; showAll: boolean; onToggleShowAll: () => void }) {
  if (!contracts.length) return null

  const allYMs = contracts.flatMap(c => [c.start, ...(c.contractedThrough ? [c.contractedThrough] : [])])
  allYMs.push(now)
  const minYM = allYMs.reduce((a, b) => a < b ? a : b)
  const hasOngoing = contracts.some(c => !c.contractedThrough)
  const maxYM = hasOngoing
    ? ymAdd(allYMs.reduce((a, b) => a > b ? a : b), 6)
    : allYMs.reduce((a, b) => a > b ? a : b)

  const toMonths = (ym: string) => {
    const [y, m] = ym.split("-").map(Number)
    return y * 12 + m
  }

  const startMo = toMonths(minYM)
  const endMo = toMonths(maxYM)
  const totalMo = endMo - startMo + 1

  if (totalMo <= 0) return null

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
      <div style={{ position: "relative", height: AXIS_H + contracts.length * ROW_H + 8 }}>
        {/* Month axis */}
        {axisTicks.map(mo => (
          <div key={mo} style={{ position: "absolute", top: 0, left: `${((mo - startMo) / totalMo) * 100}%`, transform: "translateX(-50%)", textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "#B0A9A0", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", lineHeight: 1, marginBottom: 2 }}>{moToLabel(mo)}</div>
            <div style={{ width: 1, height: 3, background: "#D1CCC5", margin: "0 auto" }} />
          </div>
        ))}
        {contracts.map((c, i) => {
          const isOngoing = !c.contractedThrough
          const effectiveThrough = c.contractedThrough ?? maxYM
          const left = ((toMonths(c.start) - startMo) / totalMo) * 100
          const width = ((toMonths(effectiveThrough) - toMonths(c.start) + 1) / totalMo) * 100
          return (
            <div key={c.id} style={{
              position: "absolute", top: AXIS_H + i * ROW_H + 4, left: `${left}%`, width: `${width}%`,
              height: BAR_H, background: ganttColor[c.status] ?? "#F5C4B4",
              borderRadius: isOngoing ? "4px 0 0 4px" : 4, opacity: 0.85, display: "flex", alignItems: "center",
              paddingLeft: 6, overflow: "hidden",
            }}>
              <span style={{ fontSize: 9, color: "#fff", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>{c.name}</span>
              {isOngoing && <span style={{ fontSize: 10, color: "#fff", fontWeight: 700, paddingRight: 4, flexShrink: 0 }}>→</span>}
            </div>
          )
        })}
        <div style={{
          position: "absolute", top: 0,
          left: `${((toMonths(now) - startMo) / totalMo) * 100}%`,
          width: 1, height: AXIS_H + contracts.length * ROW_H + 8, background: "#1A1916", opacity: 0.2,
        }} />
      </div>
    </div>
  )
}
