"use client"
import { useState } from "react"
import { useFmtCurrency } from "@/lib/CurrencyContext"

interface Contract {
  id: string
  name: string
  monthly: number
  hoursPerMonth: number
  start: string
  contractedThrough: string | null
  status: string
  type: string
  accountId?: string | null
  callDate: string | null
  signedDate: string | null
  kickoffDate: string | null
}

interface Account { id: string; name: string }

interface Props {
  clientId: string
  contracts: Contract[]
  accounts: Account[]
  onContractsChange: (contracts: Contract[]) => void
  onAccountCreated?: (account: Account) => void
}

function AccountPicker({ accounts, value, onChange, clientId, onAccountCreated }: {
  accounts: Account[]
  value: string
  onChange: (id: string) => void
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

  function close() { setOpen(false); setSearch(""); setCreating(false); setNewName("") }

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
    close()
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          padding: "7px 10px", border: `1px solid ${!value ? "#F59E0B" : "#ECE7DE"}`, borderRadius: 6,
          fontSize: 13, background: "#fff", color: "#1A1916", width: "100%", boxSizing: "border-box",
          fontFamily: "inherit", outline: "none", textAlign: "left", cursor: "pointer",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}
      >
        <span style={{ color: selected ? "#1A1916" : "#9C9590" }}>{selected ? selected.name : "Select account…"}</span>
        <span style={{ color: "#9C9590", fontSize: 10, flexShrink: 0, marginLeft: 4 }}>▾</span>
      </button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={close} />
          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100, background: "#fff", border: "1px solid #ECE7DE", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.1)", marginTop: 2, maxHeight: 240, overflowY: "auto" }}>
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
            {!creating ? (
              <button type="button" onClick={() => setCreating(true)}
                style={{ width: "100%", padding: "8px 12px", textAlign: "left", background: "none", border: "none", borderBottom: "1px solid #F5F1EC", fontSize: 12, color: "#E9532A", fontWeight: 600, cursor: "pointer" }}>
                + New account
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

function daysSince(d: string | null): number | null {
  if (!d) return null
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
}

function daysBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null
  const diff = new Date(b).getTime() - new Date(a).getTime()
  return Math.max(0, Math.floor(diff / 86400000))
}

function fmtDate(d: string | null): string {
  if (!d) return "—"
  const [y, m, day] = d.split("-")
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  return `${months[+m - 1]} ${+day}, ${y}`
}

const inputStyle: React.CSSProperties = {
  padding: "7px 10px", border: "1px solid #ECE7DE", borderRadius: 6,
  fontSize: 13, background: "#fff", color: "#1A1916",
  width: "100%", boxSizing: "border-box", fontFamily: "inherit", outline: "none",
}
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "#6B6760", display: "block", marginBottom: 4 }

interface DealCardProps {
  deal: Contract
  accounts: Account[]
  advanceLabel: string
  onAdvance: (id: string) => void
  onLost: (id: string) => void
  onRevert?: (id: string) => void
  fmt$: (v: number) => string
}

function DealCard({ deal, accounts, advanceLabel, onAdvance, onLost, onRevert, fmt$ }: DealCardProps) {
  const accountName = deal.accountId ? accounts.find(a => a.id === deal.accountId)?.name : null
  const daysSinceCall = daysSince(deal.callDate)
  const daysInPotential = deal.status === "potential" ? daysSince(deal.callDate) : null

  return (
    <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 10, padding: "14px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#1A1916" }}>{deal.name}</div>
          {accountName && (
            <div style={{ fontSize: 11, color: "#6B6760", marginTop: 2 }}>{accountName}</div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 6, fontSize: 11, color: "#9C9590" }}>
            {deal.callDate && (
              <span>
                Call: {fmtDate(deal.callDate)}
                {daysSinceCall !== null && <span style={{ color: "#C0BAB2" }}> · {daysSinceCall}d ago</span>}
              </span>
            )}
            {deal.signedDate && (
              <span>Signed: {fmtDate(deal.signedDate)}</span>
            )}
          </div>
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#1A1916", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
          {fmt$(deal.monthly)}<span style={{ fontSize: 11, fontWeight: 400, color: "#9C9590" }}>/mo</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
        {onRevert && (
          <button
            onClick={() => onRevert(deal.id)}
            style={{ padding: "6px 10px", background: "none", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 12, color: "#6B6760", cursor: "pointer", fontWeight: 500 }}
          >
            ← Opportunity
          </button>
        )}
        <button
          onClick={() => onAdvance(deal.id)}
          style={{ flex: 1, padding: "6px 10px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
        >
          {advanceLabel}
        </button>
        <button
          onClick={() => onLost(deal.id)}
          style={{ padding: "6px 12px", background: "none", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 12, color: "#C2410C", cursor: "pointer", fontWeight: 500 }}
        >
          Lost
        </button>
      </div>
    </div>
  )
}

interface DealGroupProps {
  title: string
  subtitle: string
  deals: Contract[]
  accounts: Account[]
  advanceLabel: string
  onAdvance: (id: string) => void
  onLost: (id: string) => void
  onRevert?: (id: string) => void
  fmt$: (v: number) => string
}

function DealGroup({ title, subtitle, deals, accounts, advanceLabel, onAdvance, onLost, onRevert, fmt$ }: DealGroupProps) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#9C9590", textTransform: "uppercase", letterSpacing: "0.05em" }}>{title}</span>
        <span style={{ fontSize: 11, background: "#F5F1EC", color: "#6B6760", borderRadius: 99, padding: "1px 8px", fontWeight: 600 }}>{deals.length}</span>
        <span style={{ fontSize: 11, color: "#C0BAB2" }}>· {subtitle}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {deals.map(deal => (
          <DealCard
            key={deal.id}
            deal={deal}
            accounts={accounts}
            advanceLabel={advanceLabel}
            onAdvance={onAdvance}
            onLost={onLost}
            onRevert={onRevert}
            fmt$={fmt$}
          />
        ))}
        {deals.length === 0 && (
          <div style={{ padding: "12px 16px", background: "#F5F1EC", borderRadius: 8, fontSize: 12, color: "#9C9590" }}>
            No deals in this stage
          </div>
        )}
      </div>
    </div>
  )
}

export default function PipelinePanel({ clientId, contracts, accounts: initialAccounts, onContractsChange, onAccountCreated }: Props) {
  const fmt$ = useFmtCurrency()
  const [localAccounts, setLocalAccounts] = useState<Account[]>(initialAccounts)
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState({
    name: "", monthly: "", accountId: "",
    stage: "opportunity" as "opportunity" | "potential",
    callDate: "",
  })
  const [addSaving, setAddSaving] = useState(false)

  function handleAccountCreated(account: Account) {
    setLocalAccounts(prev => [...prev, account].sort((a, b) => a.name.localeCompare(b.name)))
    onAccountCreated?.(account)
  }

  const today = new Date().toISOString().slice(0, 10)
  const nowYM = today.slice(0, 7)

  // Pipeline = open deals only
  const opportunityDeals = contracts.filter(c => c.status === "opportunity")
  const potentialDeals = contracts.filter(c => c.status === "potential")
  const wonDeals = contracts.filter(c => c.status === "active")
  const lostDeals = contracts.filter(c => c.status === "lost")
  const pipeline = [...opportunityDeals, ...potentialDeals]

  // Conversion funnel: cumulative totals per stage
  const totalEntered = opportunityDeals.length + potentialDeals.length + wonDeals.length + lostDeals.length
  const totalProposal = potentialDeals.length + wonDeals.length + lostDeals.length

  // Conversion rates
  const oppToProposalPct = totalEntered > 0 ? Math.round((totalProposal / totalEntered) * 100) : null
  const proposalToWonPct = totalProposal > 0 ? Math.round((wonDeals.length / totalProposal) * 100) : null
  const proposalToLostPct = totalProposal > 0 ? Math.round((lostDeals.length / totalProposal) * 100) : null
  const proposalStillOpenPct = totalProposal > 0 ? Math.round((potentialDeals.length / totalProposal) * 100) : null

  // Stats
  const closeRate = wonDeals.length + lostDeals.length > 0
    ? Math.round((wonDeals.length / (wonDeals.length + lostDeals.length)) * 100)
    : null

  const closeTimes = wonDeals.map(c => daysBetween(c.callDate, c.signedDate)).filter((d): d is number => d !== null)
  const avgTimeToClose = closeTimes.length > 0 ? Math.round(closeTimes.reduce((a, b) => a + b, 0) / closeTimes.length) : null

  const kickoffTimes = wonDeals.map(c => daysBetween(c.signedDate, c.kickoffDate)).filter((d): d is number => d !== null)
  const avgTimeToKickoff = kickoffTimes.length > 0 ? Math.round(kickoffTimes.reduce((a, b) => a + b, 0) / kickoffTimes.length) : null

  async function updateContract(id: string, fields: Record<string, string | null>) {
    const res = await fetch(`/api/contracts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    })
    if (!res.ok) return
    const updated = await res.json()
    onContractsChange(contracts.map(c => c.id === id ? { ...c, ...updated } : c))
  }

  async function handleAddDeal(e: React.FormEvent) {
    e.preventDefault()
    if (!addForm.accountId) return
    setAddSaving(true)
    const res = await fetch(`/api/clients/${clientId}/contracts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: addForm.name,
        monthly: parseFloat(addForm.monthly) || 0,
        start: nowYM,
        status: addForm.stage,
        type: "retainer",
        accountId: addForm.accountId || null,
        callDate: addForm.callDate || null,
      }),
    })
    if (res.ok) {
      const created = await res.json()
      onContractsChange([...contracts, { ...created, callDate: created.callDate ?? null, signedDate: created.signedDate ?? null, kickoffDate: created.kickoffDate ?? null }])
      setAddOpen(false)
      setAddForm({ name: "", monthly: "", accountId: "", stage: "opportunity", callDate: "" })
    }
    setAddSaving(false)
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "7fr 3fr", gap: 24, alignItems: "start" }}>

      {/* Left: Open Pipeline */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 22, fontWeight: 600, color: "#1A1916", margin: 0 }}>
              Pipeline
            </h2>
            <div style={{ fontSize: 13, color: "#9C9590", marginTop: 2 }}>
              {pipeline.length} open deal{pipeline.length !== 1 ? "s" : ""}
              {pipeline.length > 0 && ` · ${fmt$(pipeline.reduce((s, c) => s + c.monthly, 0))}/mo potential`}
            </div>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            style={{ padding: "8px 18px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            + Add Deal
          </button>
        </div>

        <DealGroup
          title="Opportunity"
          subtitle="Initial contact made"
          deals={opportunityDeals}
          accounts={localAccounts}
          advanceLabel="→ Potential"
          onAdvance={id => updateContract(id, { status: "potential" })}
          onLost={id => updateContract(id, { status: "lost" })}
          fmt$={fmt$}
        />

        <DealGroup
          title="Potential"
          subtitle="In negotiation"
          deals={potentialDeals}
          accounts={localAccounts}
          advanceLabel="✓ Won"
          onAdvance={id => updateContract(id, { status: "active", signedDate: today })}
          onLost={id => updateContract(id, { status: "lost" })}
          onRevert={id => updateContract(id, { status: "opportunity" })}
          fmt$={fmt$}
        />

        {pipeline.length === 0 && opportunityDeals.length === 0 && potentialDeals.length === 0 && (
          <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: 14, color: "#9C9590" }}>No open deals. Hit "+ Add Deal" to start tracking your pipeline.</div>
          </div>
        )}
      </div>

      {/* Right: Conversion Flow */}
      <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 20, position: "sticky", top: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1916", marginBottom: 16 }}>Pipeline Flow</div>

        {totalEntered === 0 ? (
          <div style={{ fontSize: 11, color: "#9C9590", marginBottom: 20 }}>Flow appears once deals are added.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 20 }}>
            {/* Opportunity */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 11 }}>
                <span style={{ color: "#6B6760", fontWeight: 600 }}>Opportunity</span>
                <span style={{ color: "#1A1916", fontWeight: 700 }}>{totalEntered}</span>
              </div>
              <div style={{ height: 10, background: "#F5F1EC", borderRadius: 5, overflow: "hidden" }}>
                <div style={{ height: "100%", width: "100%", background: "#6366F1", borderRadius: 5 }} />
              </div>
            </div>

            {/* Conversion arrow */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 0 6px 4px" }}>
              <span style={{ fontSize: 11, color: "#C0BAB2" }}>↓</span>
              <span style={{ fontSize: 11, color: "#9C9590" }}>
                {oppToProposalPct !== null ? `${oppToProposalPct}% moved to Potential` : "—"}
              </span>
            </div>

            {/* Potential */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 11 }}>
                <span style={{ color: "#6B6760", fontWeight: 600 }}>Potential</span>
                <span style={{ color: "#1A1916", fontWeight: 700 }}>{totalProposal}</span>
              </div>
              <div style={{ height: 10, background: "#F5F1EC", borderRadius: 5, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${totalEntered > 0 ? (totalProposal / totalEntered) * 100 : 0}%`, background: "#E9532A", borderRadius: 5, transition: "width 0.4s" }} />
              </div>
            </div>

            {/* Potential breakdown */}
            {totalProposal > 0 && (
              <div style={{ marginTop: 10, marginLeft: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  { label: "Won", count: wonDeals.length, pct: proposalToWonPct, color: "#1F7A4D", bg: "#DCFCE7" },
                  { label: "Lost", count: lostDeals.length, pct: proposalToLostPct, color: "#9C9590", bg: "#F3F4F6" },
                  { label: "Still Open", count: potentialDeals.length, pct: proposalStillOpenPct, color: "#92400E", bg: "#FFF7ED" },
                ].map(row => (
                  <div key={row.label}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, fontSize: 11 }}>
                      <span style={{ color: "#6B6760" }}>{row.label}</span>
                      <span style={{ color: "#1A1916", fontWeight: 600 }}>{row.count} <span style={{ color: "#9C9590", fontWeight: 400 }}>({row.pct ?? 0}%)</span></span>
                    </div>
                    <div style={{ height: 7, background: "#F5F1EC", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${row.pct ?? 0}%`, background: row.color, borderRadius: 4, transition: "width 0.4s" }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ borderTop: "1px solid #ECE7DE", paddingTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          {closeRate !== null ? (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#6B6760" }}>Close Rate</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: closeRate >= 50 ? "#1F7A4D" : "#C2410C" }}>{closeRate}%</span>
            </div>
          ) : (
            <div style={{ fontSize: 11, color: "#9C9590" }}>Close rate appears once deals are won or lost.</div>
          )}
          {avgTimeToClose !== null && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#6B6760" }}>Avg time to close</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#1A1916" }}>{avgTimeToClose}d</span>
            </div>
          )}
          {avgTimeToKickoff !== null && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#6B6760" }}>Avg time to kickoff</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#1A1916" }}>{avgTimeToKickoff}d</span>
            </div>
          )}
        </div>
      </div>

      {/* Add Deal Modal */}
      {addOpen && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={e => { if (e.target === e.currentTarget) setAddOpen(false) }}
        >
          <div style={{ background: "#fff", borderRadius: 14, padding: 28, width: 440, boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
            <h3 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 22, fontWeight: 600, margin: "0 0 20px", color: "#1A1916" }}>
              New Deal
            </h3>
            <form onSubmit={handleAddDeal} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={labelStyle}>Deal Name</label>
                <input style={inputStyle} value={addForm.name}
                  onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Acme Corp SEO Retainer" required />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Monthly Value</label>
                  <div style={{ display: "flex", alignItems: "center", border: "1px solid #ECE7DE", borderRadius: 6, background: "#fff" }}>
                    <span style={{ padding: "0 2px 0 10px", fontSize: 13, color: "#9C9590", flexShrink: 0 }}>$</span>
                    <input
                      style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: "inherit", fontSize: 13, color: "#1A1916", padding: "7px 10px 7px 4px" }}
                      type="number" min={0} step={100} value={addForm.monthly}
                      onChange={e => setAddForm(f => ({ ...f, monthly: e.target.value }))}
                      placeholder="5000" />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Stage</label>
                  <select style={inputStyle} value={addForm.stage}
                    onChange={e => setAddForm(f => ({ ...f, stage: e.target.value as "opportunity" | "potential" }))}>
                    <option value="opportunity">Opportunity</option>
                    <option value="potential">Potential</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Account <span style={{ color: "#E9532A" }}>*</span></label>
                  <AccountPicker
                    accounts={localAccounts}
                    value={addForm.accountId}
                    onChange={id => setAddForm(f => ({ ...f, accountId: id }))}
                    clientId={clientId}
                    onAccountCreated={handleAccountCreated}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Initial Call Date</label>
                  <input style={inputStyle} type="date" value={addForm.callDate}
                    onChange={e => setAddForm(f => ({ ...f, callDate: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                <button type="button" onClick={() => setAddOpen(false)}
                  style={{ padding: "8px 16px", background: "none", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 13, cursor: "pointer", color: "#6B6760" }}>
                  Cancel
                </button>
                <button type="submit" disabled={addSaving || !addForm.accountId}
                  style={{ padding: "8px 20px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: addSaving || !addForm.accountId ? 0.5 : 1 }}>
                  {addSaving ? "Adding…" : "Add Deal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
