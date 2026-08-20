"use client"
import { useState } from "react"
import OneoffDelivery from "./OneoffDelivery"

type ContractTypeField = "retainer" | "ongoing" | "oneoff"
type ContractStatus = "opportunity" | "potential" | "active" | "lost" | "finished"

interface Contract {
  id: string
  name: string
  monthly: number
  hoursPerMonth?: number
  start: string
  contractedThrough: string | null
  status: string
  type: string
  accountId?: string | null
  productId?: string | null
  deliveryStart?: string | null
  deliveryEnd?: string | null
  ownerId?: string | null
}

interface Account { id: string; name: string }
interface Person { id: string; name: string; isExternal: boolean }
interface Product { id: string; name: string }

const inputStyle: React.CSSProperties = {
  padding: "7px 10px", border: "1px solid #ECE7DE", borderRadius: 6,
  fontSize: 13, background: "#fff", color: "#1A1916",
  width: "100%", boxSizing: "border-box", fontFamily: "inherit", outline: "none",
}
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "#6B6760", display: "block", marginBottom: 4 }

export default function ContractEditModal({ contract, accounts, products = [], people = [], clientId, onClose, onSaved, onAccountCreated }: {
  contract: Contract
  accounts: Account[]
  products?: Product[]
  people?: Person[]
  clientId: string
  onClose: () => void
  onSaved: (updated: Contract) => void
  onAccountCreated: (account: Account) => void
}) {
  const teamMembers = people.filter(p => !p.isExternal)
  const [localAccounts, setLocalAccounts] = useState<Account[]>(accounts)
  const [creatingAccount, setCreatingAccount] = useState(false)
  const [newAccountName, setNewAccountName] = useState("")
  const [creatingSaving, setCreatingSaving] = useState(false)
  const uiType: ContractTypeField = !contract.contractedThrough && contract.type === "retainer" ? "ongoing" : ((contract.type as ContractTypeField) ?? "retainer")
  const [form, setForm] = useState({
    name: contract.name,
    monthly: String(contract.monthly),
    hoursPerMonth: String(contract.hoursPerMonth ?? 0),
    start: contract.start,
    contractedThrough: contract.contractedThrough ?? "",
    status: contract.status as ContractStatus,
    type: uiType,
    accountId: contract.accountId ?? null as string | null,
    ownerId: contract.ownerId ?? null as string | null,
    productId: contract.productId ?? null as string | null,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const isOngoing = form.type === "ongoing"
    const payload = {
      name: form.name,
      monthly: parseFloat(form.monthly),
      hoursPerMonth: parseFloat(form.hoursPerMonth) || 0,
      status: form.status,
      accountId: form.accountId,
      ownerId: form.ownerId,
      start: form.start,
      type: isOngoing ? "retainer" : form.type,
      contractedThrough: isOngoing ? null : form.type === "oneoff" ? form.start : form.contractedThrough || null,
      productId: form.productId,
    }
    const res = await fetch(`/api/contracts/${contract.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    if (!res.ok) { setError("Failed to save"); return }
    const updated = await res.json()
    onSaved({ ...updated, accountId: form.accountId, ownerId: form.ownerId, productId: form.productId })
    onClose()
  }

  async function createAccount() {
    const name = newAccountName.trim()
    if (!name) return
    setCreatingSaving(true)
    const res = await fetch(`/api/clients/${clientId}/accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
    setCreatingSaving(false)
    if (!res.ok) return
    const account: Account = await res.json()
    setLocalAccounts(prev => [...prev, account].sort((a, b) => a.name.localeCompare(b.name)))
    setForm(f => ({ ...f, accountId: account.id }))
    onAccountCreated(account)
    setCreatingAccount(false)
    setNewAccountName("")
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: "#fff", borderRadius: 14, padding: 28, width: 460, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
        <h2 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 22, fontWeight: 600, margin: "0 0 20px", color: "#1A1916" }}>Edit Project</h2>
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
            {creatingAccount ? (
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  autoFocus
                  value={newAccountName}
                  onChange={e => setNewAccountName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); createAccount() } if (e.key === "Escape") { setCreatingAccount(false); setNewAccountName("") } }}
                  placeholder="New account name"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button type="button" onClick={createAccount} disabled={creatingSaving || !newAccountName.trim()}
                  style={{ padding: "7px 14px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", opacity: creatingSaving || !newAccountName.trim() ? 0.6 : 1 }}>
                  {creatingSaving ? "…" : "Add"}
                </button>
                <button type="button" onClick={() => { setCreatingAccount(false); setNewAccountName("") }}
                  style={{ padding: "7px 12px", background: "none", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 13, cursor: "pointer", color: "#6B6760" }}>
                  Cancel
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <select style={{ ...inputStyle, flex: 1 }} value={form.accountId ?? ""} onChange={e => setForm(f => ({ ...f, accountId: e.target.value || null }))}>
                  <option value="">Unassigned</option>
                  {localAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <button type="button" onClick={() => setCreatingAccount(true)}
                  style={{ padding: "7px 12px", background: "none", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 13, cursor: "pointer", color: "#6B6760", whiteSpace: "nowrap" }}>
                  + New
                </button>
              </div>
            )}
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
          {products.length > 0 && (
            <div>
              <label style={labelStyle}>Product <span style={{ color: "#C0BAB2", fontWeight: 400 }}>(package)</span></label>
              <select style={inputStyle} value={form.productId ?? ""} onChange={e => setForm(f => ({ ...f, productId: e.target.value || null }))}>
                <option value="">— None —</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
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
            <>
            <div>
              <label style={labelStyle}>Month Paid</label>
              <input style={inputStyle} type="month" value={form.start} onChange={e => setForm(f => ({ ...f, start: e.target.value, contractedThrough: e.target.value }))} required />
            </div>
            <OneoffDelivery contractId={contract.id} paymentMonth={form.start} initialStart={contract.deliveryStart ?? null} initialEnd={contract.deliveryEnd ?? null} />
            </>
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
              style={{ padding: "8px 16px", background: "none", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 13, cursor: "pointer", color: "#6B6760" }}>Cancel</button>
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
