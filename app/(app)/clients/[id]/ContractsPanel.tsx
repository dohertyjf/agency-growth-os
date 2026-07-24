"use client"
import { useState } from "react"
import { fmtCurrency, ymLabel, bookedAhead, currentMRR, type ContractRow } from "@/lib/calc"

interface Contract {
  id: string
  name: string
  monthly: number
  start: string
  contractedThrough: string
  status: string
  type: string
}

interface Props {
  clientId: string
  initialContracts: Contract[]
  onContractsChange?: (contracts: Contract[]) => void
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

type ContractTypeField = "retainer" | "oneoff"

// ── Bulk import ───────────────────────────────────────────────────────────────

interface ParsedRow {
  name: string
  type: ContractTypeField
  monthly: number
  status: ContractStatus
  start: string
  contractedThrough: string
  errors: string[]
}

const now2 = new Date().toISOString().slice(0, 7)

function normalizeType(raw: string): ContractTypeField {
  const s = raw.toLowerCase().trim()
  if (s === "oneoff" || s === "one-off" || s === "one off" || s === "o") return "oneoff"
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
    const contractedThrough = type === "oneoff" ? start : (throughRaw || start)
    if (type === "retainer" && !throughRaw) errors.push("Through date required for retainer")

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
            <br />Type: retainer or one-off &nbsp;·&nbsp; Status: active, potential, or finished &nbsp;·&nbsp; Dates: YYYY-MM
          </p>
        </div>

        <textarea
          autoFocus
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={"Acme Corp\tretainer\t1500\tactive\t2026-01\t2026-12\nBeta Co\toneoff\t850\tactive\t2026-05\t2026-05"}
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
}

function DuplicateModal({ contract, clientId, onClose, onSave }: { contract: Contract; clientId: string; onClose: () => void; onSave: (c: Contract) => void }) {
  const [form, setForm] = useState<EditForm>({
    name: "",
    monthly: String(contract.monthly),
    start: contract.start,
    contractedThrough: contract.contractedThrough,
    status: "potential" as ContractStatus,
    type: (contract.type as ContractTypeField) ?? "retainer",
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/clients/${clientId}/contracts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, monthly: parseFloat(form.monthly) }),
    })
    setSaving(false)
    if (!res.ok) { setError("Failed to save"); return }
    const created = await res.json()
    onSave(created.contract ?? created)
    onClose()
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: "#fff", borderRadius: 14, padding: 28, width: 460, boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
        <h2 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 22, fontWeight: 600, margin: "0 0 4px", color: "#1A1916" }}>
          Duplicate Account
        </h2>
        <p style={{ fontSize: 12, color: "#9C9590", margin: "0 0 20px" }}>Copied from <strong style={{ color: "#6B6760" }}>{contract.name}</strong> — enter a new name to save.</p>
        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Type</label>
              <select style={inputStyle} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as ContractTypeField }))}>
                <option value="retainer">Retainer</option>
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
            <label style={labelStyle}>Account Name</label>
            <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="New client name" autoFocus />
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Start</label>
                <input style={inputStyle} type="month" value={form.start} onChange={e => setForm(f => ({ ...f, start: e.target.value }))} required />
              </div>
              <div>
                <label style={labelStyle}>Through</label>
                <input style={inputStyle} type="month" value={form.contractedThrough} onChange={e => setForm(f => ({ ...f, contractedThrough: e.target.value }))} required />
              </div>
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

function EditModal({ contract, onClose, onSave }: { contract: Contract; onClose: () => void; onSave: (c: Contract) => void }) {
  const [form, setForm] = useState<EditForm>({
    name: contract.name,
    monthly: String(contract.monthly),
    start: contract.start,
    contractedThrough: contract.contractedThrough,
    status: contract.status as ContractStatus,
    type: (contract.type as ContractTypeField) ?? "retainer",
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/contracts/${contract.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, monthly: parseFloat(form.monthly) }),
    })
    setSaving(false)
    if (!res.ok) { setError("Failed to save"); return }
    const updated = await res.json()
    onSave(updated)
    onClose()
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: "#fff", borderRadius: 14, padding: 28, width: 460, boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
        <h2 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 22, fontWeight: 600, margin: "0 0 20px", color: "#1A1916" }}>
          Edit Account
        </h2>
        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Type</label>
              <select style={inputStyle} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as ContractTypeField }))}>
                <option value="retainer">Retainer</option>
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
            <label style={labelStyle}>Account Name</label>
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Start</label>
                <input style={inputStyle} type="month" value={form.start} onChange={e => setForm(f => ({ ...f, start: e.target.value }))} required />
              </div>
              <div>
                <label style={labelStyle}>Through</label>
                <input style={inputStyle} type="month" value={form.contractedThrough} onChange={e => setForm(f => ({ ...f, contractedThrough: e.target.value }))} required />
              </div>
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

export default function ContractsPanel({ clientId, initialContracts, onContractsChange }: Props) {
  const [contracts, setContracts] = useState<Contract[]>(initialContracts)
  const [adding, setAdding] = useState(false)
  const [bulkImporting, setBulkImporting] = useState(false)
  const [editingContract, setEditingContract] = useState<Contract | null>(null)
  const [duplicatingContract, setDuplicatingContract] = useState<Contract | null>(null)
  const [form, setForm] = useState({ name: "", monthly: "", start: now, contractedThrough: "", status: "potential" as ContractStatus, type: "retainer" as ContractTypeField })
  const [saving, setSaving] = useState(false)
  const [showPast, setShowPast] = useState(false)

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
    const res = await fetch(`/api/clients/${clientId}/contracts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, monthly: parseFloat(form.monthly) }),
    })
    const data = await res.json()
    if (res.ok) {
      updateContracts([...contracts, data.contract ?? data])
      setForm({ name: "", monthly: "", start: now, contractedThrough: "", status: "potential", type: "retainer" })
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
        <EditModal contract={editingContract} onClose={() => setEditingContract(null)} onSave={handleEdited} />
      )}
      {duplicatingContract && (
        <DuplicateModal contract={duplicatingContract} clientId={clientId} onClose={() => setDuplicatingContract(null)} onSave={handleDuplicated} />
      )}
      {bulkImporting && (
        <BulkImportModal clientId={clientId} onClose={() => setBulkImporting(false)} onImport={handleBulkImported} />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1916" }}>Accounts</div>
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
            + Add Account
          </button>
        </div>
      </div>

      {adding && (
        <form onSubmit={handleAdd} style={{ background: "#FBFAF7", border: "1px solid #ECE7DE", borderRadius: 8, padding: 16, marginBottom: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
            <div>
              <label style={{ fontSize: 11, color: "#9C9590", display: "block", marginBottom: 4 }}>Account Name</label>
              <input style={{ ...inputStyle, background: "#FBFAF7" }} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Acme Corp" autoFocus />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "#9C9590", display: "block", marginBottom: 4 }}>Type</label>
              <select style={{ ...inputStyle, background: "#FBFAF7" }} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as ContractTypeField }))}>
                <option value="retainer">Retainer</option>
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
          {form.type === "oneoff" ? (
            <div style={{ maxWidth: 200 }}>
              <label style={{ fontSize: 11, color: "#9C9590", display: "block", marginBottom: 4 }}>Month Paid</label>
              <input style={{ ...inputStyle, background: "#FBFAF7" }} type="month" value={form.start} onChange={e => setForm(f => ({ ...f, start: e.target.value, contractedThrough: e.target.value }))} required />
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 3fr", gap: 8 }}>
              <div>
                <label style={{ fontSize: 11, color: "#9C9590", display: "block", marginBottom: 4 }}>Start</label>
                <input style={{ ...inputStyle, background: "#FBFAF7" }} type="month" value={form.start} onChange={e => setForm(f => ({ ...f, start: e.target.value }))} required />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#9C9590", display: "block", marginBottom: 4 }}>Through</label>
                <input style={{ ...inputStyle, background: "#FBFAF7" }} type="month" value={form.contractedThrough} onChange={e => setForm(f => ({ ...f, contractedThrough: e.target.value }))} required />
              </div>
            </div>
          )}
        </form>
      )}

      {contracts.length === 0 ? (
        <div style={{ color: "#9C9590", fontSize: 13 }}>No contracts yet.</div>
      ) : (
        <>
          <ContractGantt contracts={contracts} now={now} />

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
                {isOneoff ? ymLabel(c.start) : `${ymLabel(c.start)} – ${ymLabel(c.contractedThrough)}`}
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

function ContractGantt({ contracts, now }: { contracts: Contract[]; now: string }) {
  if (!contracts.length) return null

  const allYMs = contracts.flatMap(c => [c.start, c.contractedThrough])
  allYMs.push(now)
  const minYM = allYMs.reduce((a, b) => a < b ? a : b)
  const maxYM = allYMs.reduce((a, b) => a > b ? a : b)

  const toMonths = (ym: string) => {
    const [y, m] = ym.split("-").map(Number)
    return y * 12 + m
  }

  const startMo = toMonths(minYM)
  const endMo = toMonths(maxYM)
  const totalMo = endMo - startMo + 1

  if (totalMo <= 0) return null

  const ganttColor: Record<string, string> = { active: "#E9532A", potential: "#F5C4B4", finished: "#D1D5DB" }

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 10, color: "#9C9590", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Account Runway</div>
      <div style={{ position: "relative", height: contracts.length * 24 + 8 }}>
        {contracts.map((c, i) => {
          const left = ((toMonths(c.start) - startMo) / totalMo) * 100
          const width = ((toMonths(c.contractedThrough) - toMonths(c.start) + 1) / totalMo) * 100
          return (
            <div key={c.id} style={{
              position: "absolute", top: i * 24 + 4, left: `${left}%`, width: `${width}%`,
              height: 16, background: ganttColor[c.status] ?? "#F5C4B4",
              borderRadius: 4, opacity: 0.85, display: "flex", alignItems: "center",
              paddingLeft: 6, overflow: "hidden",
            }}>
              <span style={{ fontSize: 9, color: "#fff", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
            </div>
          )
        })}
        <div style={{
          position: "absolute", top: 0,
          left: `${((toMonths(now) - startMo) / totalMo) * 100}%`,
          width: 1, height: contracts.length * 24 + 8, background: "#1A1916", opacity: 0.2,
        }} />
      </div>
    </div>
  )
}
