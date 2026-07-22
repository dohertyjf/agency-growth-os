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
}

interface Props {
  clientId: string
  initialContracts: Contract[]
}

type ContractStatus = "potential" | "active" | "finished"

const STATUS_LABELS: Record<ContractStatus, string> = { potential: "Potential", active: "Active", finished: "Finished" }
const STATUS_COLORS: Record<ContractStatus, { bg: string; text: string }> = {
  potential: { bg: "#FFF7ED", text: "#92400E" },
  active: { bg: "#DCFCE7", text: "#166534" },
  finished: { bg: "#F3F4F6", text: "#6B7280" },
}

function toRow(c: Contract): ContractRow {
  return { monthly: c.monthly, start: c.start, contractedThrough: c.contractedThrough, status: c.status as "active" | "potential" }
}

const now = new Date().toISOString().slice(0, 7)

const inputStyle: React.CSSProperties = {
  padding: "7px 10px", border: "1px solid #ECE7DE", borderRadius: 6,
  fontSize: 13, background: "#fff", color: "#1A1916",
  width: "100%", boxSizing: "border-box", fontFamily: "inherit", outline: "none",
}
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "#6B6760", display: "block", marginBottom: 4 }

interface EditForm {
  name: string
  monthly: string
  start: string
  contractedThrough: string
  status: ContractStatus
}

function EditModal({ contract, onClose, onSave }: { contract: Contract; onClose: () => void; onSave: (c: Contract) => void }) {
  const [form, setForm] = useState<EditForm>({
    name: contract.name,
    monthly: String(contract.monthly),
    start: contract.start,
    contractedThrough: contract.contractedThrough,
    status: contract.status as ContractStatus,
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
          Edit Contract
        </h2>
        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>Contract Name</label>
            <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div>
            <label style={labelStyle}>Monthly ($)</label>
            <input style={inputStyle} type="number" value={form.monthly} onChange={e => setForm(f => ({ ...f, monthly: e.target.value }))} required min={0} />
          </div>
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
          <div>
            <label style={labelStyle}>Status</label>
            <select style={inputStyle} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as ContractStatus }))}>
              <option value="potential">Potential</option>
              <option value="active">Active</option>
              <option value="finished">Finished</option>
            </select>
          </div>
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

export default function ContractsPanel({ clientId, initialContracts }: Props) {
  const [contracts, setContracts] = useState<Contract[]>(initialContracts)
  const [adding, setAdding] = useState(false)
  const [editingContract, setEditingContract] = useState<Contract | null>(null)
  const [form, setForm] = useState({ name: "", monthly: "", start: now, contractedThrough: "", status: "potential" as ContractStatus })
  const [saving, setSaving] = useState(false)

  const rows = contracts.map(toRow)
  const mrr = currentMRR(rows, now)
  const booked = bookedAhead(rows, now)

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
      const contract = data.contract ?? data
      setContracts(prev => [...prev, contract])
      setForm({ name: "", monthly: "", start: now, contractedThrough: "", status: "potential" })
      setAdding(false)
    }
    setSaving(false)
  }

  async function handleDelete(contractId: string) {
    await fetch(`/api/contracts/${contractId}`, { method: "DELETE" })
    setContracts(prev => prev.filter(c => c.id !== contractId))
  }

  function handleEdited(updated: Contract) {
    setContracts(prev => prev.map(c => c.id === updated.id ? updated : c))
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 20 }}>
      {editingContract && (
        <EditModal
          contract={editingContract}
          onClose={() => setEditingContract(null)}
          onSave={handleEdited}
        />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1916" }}>Contracts</div>
          <div style={{ fontSize: 11, color: "#9C9590", marginTop: 2 }}>
            MRR {fmtCurrency(mrr)} · {fmtCurrency(booked)} booked ahead
          </div>
        </div>
        <button
          onClick={() => setAdding(a => !a)}
          style={{ padding: "6px 14px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
        >
          + Add Contract
        </button>
      </div>

      {adding && (
        <form onSubmit={handleAdd} style={{ background: "#FBFAF7", border: "1px solid #ECE7DE", borderRadius: 8, padding: 16, marginBottom: 16, display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
          <div>
            <label style={{ fontSize: 11, color: "#9C9590", display: "block", marginBottom: 4 }}>Contract Name</label>
            <input style={{ ...inputStyle, background: "#FBFAF7" }} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Acme Corp" />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#9C9590", display: "block", marginBottom: 4 }}>Monthly ($)</label>
            <input style={{ ...inputStyle, background: "#FBFAF7" }} type="number" value={form.monthly} onChange={e => setForm(f => ({ ...f, monthly: e.target.value }))} required placeholder="5000" />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#9C9590", display: "block", marginBottom: 4 }}>Start</label>
            <input style={{ ...inputStyle, background: "#FBFAF7" }} type="month" value={form.start} onChange={e => setForm(f => ({ ...f, start: e.target.value }))} required />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#9C9590", display: "block", marginBottom: 4 }}>Through</label>
            <input style={{ ...inputStyle, background: "#FBFAF7" }} type="month" value={form.contractedThrough} onChange={e => setForm(f => ({ ...f, contractedThrough: e.target.value }))} required />
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
        </form>
      )}

      {contracts.length === 0 ? (
        <div style={{ color: "#9C9590", fontSize: 13 }}>No contracts yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <ContractGantt contracts={contracts} now={now} />
          {contracts.map(c => {
            const s = (c.status as ContractStatus) in STATUS_COLORS ? c.status as ContractStatus : "potential"
            const colors = STATUS_COLORS[s]
            return (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #F5F1EC" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#1A1916" }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: "#9C9590" }}>{ymLabel(c.start)} – {ymLabel(c.contractedThrough)}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1A1916", fontVariantNumeric: "tabular-nums", minWidth: 80, textAlign: "right" }}>
                  {fmtCurrency(c.monthly)}/mo
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20,
                  background: colors.bg, color: colors.text,
                  textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap",
                }}>
                  {STATUS_LABELS[s]}
                </span>
                <button
                  onClick={() => setEditingContract(c)}
                  style={{ background: "none", border: "1px solid #ECE7DE", borderRadius: 5, color: "#6B6760", cursor: "pointer", fontSize: 12, padding: "3px 10px" }}
                >
                  Edit
                </button>
                <button onClick={() => handleDelete(c.id)} style={{ background: "none", border: "none", color: "#9C9590", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "0 4px" }}>×</button>
              </div>
            )
          })}
        </div>
      )}
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
      <div style={{ fontSize: 10, color: "#9C9590", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Contract Runway</div>
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
