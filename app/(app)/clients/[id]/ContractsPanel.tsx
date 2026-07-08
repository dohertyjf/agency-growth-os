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

function toRow(c: Contract): ContractRow {
  return { monthly: c.monthly, start: c.start, contractedThrough: c.contractedThrough, status: c.status as "active" | "potential" }
}

const now = new Date().toISOString().slice(0, 7)

const inputStyle: React.CSSProperties = {
  padding: "6px 10px",
  border: "1px solid #ECE7DE",
  borderRadius: 5,
  fontSize: 13,
  background: "#FBFAF7",
  color: "#1A1916",
  width: "100%",
  boxSizing: "border-box",
}

export default function ContractsPanel({ clientId, initialContracts }: Props) {
  const [contracts, setContracts] = useState<Contract[]>(initialContracts)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: "", monthly: "", start: now, contractedThrough: "", status: "active" })
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
    if (res.ok && data.contract) {
      setContracts(prev => [...prev, data.contract])
      setForm({ name: "", monthly: "", start: now, contractedThrough: "", status: "active" })
      setAdding(false)
    }
    setSaving(false)
  }

  async function handleDelete(contractId: string) {
    await fetch(`/api/contracts/${contractId}`, { method: "DELETE" })
    setContracts(prev => prev.filter(c => c.id !== contractId))
  }

  async function handleStatusToggle(contract: Contract) {
    const newStatus = contract.status === "active" ? "potential" : "active"
    const res = await fetch(`/api/contracts/${contract.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      setContracts(prev => prev.map(c => c.id === contract.id ? { ...c, status: newStatus } : c))
    }
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 20 }}>
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

      {/* Add form */}
      {adding && (
        <form onSubmit={handleAdd} style={{ background: "#FBFAF7", border: "1px solid #ECE7DE", borderRadius: 8, padding: 16, marginBottom: 16, display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
          <div>
            <label style={{ fontSize: 11, color: "#9C9590", display: "block", marginBottom: 4 }}>Client Name</label>
            <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Acme Corp" />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#9C9590", display: "block", marginBottom: 4 }}>Monthly ($)</label>
            <input style={inputStyle} type="number" value={form.monthly} onChange={e => setForm(f => ({ ...f, monthly: e.target.value }))} required placeholder="5000" />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#9C9590", display: "block", marginBottom: 4 }}>Start</label>
            <input style={inputStyle} type="month" value={form.start} onChange={e => setForm(f => ({ ...f, start: e.target.value }))} required />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#9C9590", display: "block", marginBottom: 4 }}>Through</label>
            <input style={inputStyle} type="month" value={form.contractedThrough} onChange={e => setForm(f => ({ ...f, contractedThrough: e.target.value }))} required />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#9C9590", display: "block", marginBottom: 4 }}>Status</label>
            <select style={{ ...inputStyle }} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              <option value="active">Active</option>
              <option value="potential">Potential</option>
            </select>
          </div>
          <button type="submit" disabled={saving} style={{ padding: "6px 14px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", height: 32, alignSelf: "end" }}>
            Save
          </button>
        </form>
      )}

      {/* Contract list */}
      {contracts.length === 0 ? (
        <div style={{ color: "#9C9590", fontSize: 13 }}>No contracts yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {/* Gantt-style runway */}
          <ContractGantt contracts={contracts} now={now} />

          {contracts.map(c => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #F5F1EC" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "#1A1916" }}>{c.name}</div>
                <div style={{ fontSize: 11, color: "#9C9590" }}>{ymLabel(c.start)} – {ymLabel(c.contractedThrough)}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1A1916", fontVariantNumeric: "tabular-nums", minWidth: 80, textAlign: "right" }}>
                {fmtCurrency(c.monthly)}/mo
              </div>
              <button
                onClick={() => handleStatusToggle(c)}
                style={{
                  fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, border: "none", cursor: "pointer",
                  background: c.status === "active" ? "#DCFCE7" : "#FFF7ED",
                  color: c.status === "active" ? "#166534" : "#92400E",
                  textTransform: "uppercase", letterSpacing: "0.04em",
                }}
              >
                {c.status}
              </button>
              <button onClick={() => handleDelete(c.id)} style={{ background: "none", border: "none", color: "#9C9590", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "0 4px" }}>×</button>
            </div>
          ))}
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

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 10, color: "#9C9590", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Contract Runway</div>
      <div style={{ position: "relative", height: contracts.length * 24 + 8 }}>
        {contracts.map((c, i) => {
          const left = ((toMonths(c.start) - startMo) / totalMo) * 100
          const width = ((toMonths(c.contractedThrough) - toMonths(c.start) + 1) / totalMo) * 100
          return (
            <div key={c.id} style={{
              position: "absolute",
              top: i * 24 + 4,
              left: `${left}%`,
              width: `${width}%`,
              height: 16,
              background: c.status === "active" ? "#E9532A" : "#F5C4B4",
              borderRadius: 4,
              opacity: 0.85,
              display: "flex",
              alignItems: "center",
              paddingLeft: 6,
              overflow: "hidden",
            }}>
              <span style={{ fontSize: 9, color: "#fff", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
            </div>
          )
        })}
        {/* Today marker */}
        <div style={{
          position: "absolute",
          top: 0,
          left: `${((toMonths(now) - startMo) / totalMo) * 100}%`,
          width: 1,
          height: contracts.length * 24 + 8,
          background: "#1A1916",
          opacity: 0.2,
        }} />
      </div>
    </div>
  )
}
