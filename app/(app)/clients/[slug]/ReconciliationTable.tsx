"use client"
import { useState } from "react"
import { fmtCurrency } from "@/lib/calc"
import { useFmtCurrency } from "@/lib/CurrencyContext"
import ContractEditModal from "./ContractEditModal"

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
}

interface Account {
  id: string
  name: string
}

interface AccountMonth {
  contractId: string
  month: string
  actual: number
}

interface Payment {
  contractId: string
  month: string
  amount: number
}

interface Props {
  contracts: Contract[]
  accounts: Account[]
  clientId: string
  initialAccountMonths: AccountMonth[]
  initialPayments: Payment[]
  onRevenueUpdate: (month: string, revenue: number) => void
  onPaymentsChange: (payments: Payment[]) => void
  onContractUpdate: (updated: Contract) => void
  onAccountCreated: (account: Account) => void
}

function monthsBetween(start: string, end: string): string[] {
  const months: string[] = []
  const [sy, sm] = start.split("-").map(Number)
  const [ey, em] = end.split("-").map(Number)
  let y = sy, m = sm
  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}-${String(m).padStart(2, "0")}`)
    m++
    if (m > 12) { m = 1; y++ }
  }
  return months
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number)
  const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  return `${names[m - 1]} '${String(y).slice(2)}`
}

const now = new Date().toISOString().slice(0, 7)

// Confidence bands shown in the grid, in display order. Signed work (active/
// finished) first, then speculative (qualified/opportunity) which is tagged.
const BAND_ORDER: Record<string, number> = { active: 0, finished: 1, potential: 2, opportunity: 3 }
const STATUS_TAG: Record<string, { label: string; bg: string; color: string }> = {
  potential: { label: "Qualified", bg: "#FEF3C7", color: "#92400E" },
  opportunity: { label: "Opportunity", bg: "#DBEAFE", color: "#1D4ED8" },
}
const BAND_FILTERS: { key: string; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "potential", label: "Qualified" },
  { key: "opportunity", label: "Opportunity" },
  { key: "finished", label: "Finished" },
]

function ymAdd(ym: string, months: number): string {
  const [y, m] = ym.split("-").map(Number)
  const total = y * 12 + m - 1 + months
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`
}

export default function ReconciliationTable({ contracts, accounts, clientId, initialAccountMonths, initialPayments, onRevenueUpdate, onPaymentsChange, onContractUpdate, onAccountCreated }: Props) {
  const fmtCurrency = useFmtCurrency()
  const [editingContract, setEditingContract] = useState<Contract | null>(null)
  const [accountMonths, setAccountMonths] = useState<AccountMonth[]>(initialAccountMonths)
  const [payments, setPayments] = useState<Payment[]>(initialPayments)
  const [editing, setEditing] = useState<{ contractId: string; month: string } | null>(null)
  const [editingPayment, setEditingPayment] = useState<{ contractId: string; month: string } | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [savingPayment, setSavingPayment] = useState<string | null>(null)
  const [range, setRange] = useState<3 | 6 | 12 | "all">("all")
  // Which confidence bands to show. Finished defaults off — it just clogs the grid.
  const [bands, setBands] = useState<Record<string, boolean>>({ active: true, potential: true, opportunity: true, finished: false })

  const allBandContracts = contracts.filter(c => c.status in BAND_ORDER)
  if (allBandContracts.length === 0) return null

  const shownContracts = allBandContracts
    .filter(c => bands[c.status])
    .sort((a, b) => (BAND_ORDER[a.status] - BAND_ORDER[b.status]) || a.start.localeCompare(b.start))
  const signedContracts = shownContracts.filter(c => c.status === "active" || c.status === "finished")

  // Only bands actually present in the data get a filter chip.
  const availableBands = BAND_FILTERS.filter(b => allBandContracts.some(c => c.status === b.key))

  // Extend the window forward so ongoing/future work (e.g. a qualified continuation
  // starting next month) is visible — ongoing contracts have no end date, so cap them
  // at the later of year-end and ~6 months out.
  const months: string[] = (() => {
    if (shownContracts.length === 0) return []
    const yearEnd = `${now.slice(0, 4)}-12`
    const forwardHorizon = [yearEnd, ymAdd(now, 5)].reduce((a, b) => a > b ? a : b)
    const allEnds = shownContracts.map(c => c.contractedThrough ?? forwardHorizon)
    const rangeEnd = [now, ...allEnds].reduce((a, b) => a > b ? a : b)
    const windowStart = range === "all"
      ? shownContracts.map(c => c.start).reduce((a, b) => a < b ? a : b)
      : ymAdd(now, -(range - 1))
    const hasEarlyPayment = payments.some(p => p.month < windowStart)
    const effectiveStart = hasEarlyPayment ? ymAdd(windowStart, -1) : windowStart
    return monthsBetween(effectiveStart, rangeEnd).filter(m => shownContracts.some(c => contractActiveInMonth(c, m)))
  })()

  function getActual(contractId: string, month: string) {
    return accountMonths.find(am => am.contractId === contractId && am.month === month)
  }

  function getPayment(contractId: string, month: string) {
    return payments.find(p => p.contractId === contractId && p.month === month)
  }

  function contractActiveInMonth(c: Contract, month: string) {
    return c.start <= month && (c.contractedThrough === null || c.contractedThrough >= month)
  }

  async function handleSave(contractId: string, month: string, rawValue: string) {
    const actual = parseFloat(rawValue.replace(/[$,\s]/g, ""))
    if (isNaN(actual) || actual < 0) { setEditing(null); return }

    const key = `${contractId}:${month}`
    setSaving(key)
    setEditing(null)

    const res = await fetch(`/api/contracts/${contractId}/months`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, actual }),
    })

    setSaving(null)
    if (!res.ok) return

    const data = await res.json()
    setAccountMonths(prev => {
      const next = prev.filter(am => !(am.contractId === contractId && am.month === month))
      return [...next, { contractId, month, actual }]
    })
    onRevenueUpdate(month, data.revenue)
  }

  async function handlePaymentSave(contractId: string, month: string, rawValue: string) {
    const amount = parseFloat(rawValue.replace(/[$,\s]/g, ""))
    if (isNaN(amount) || amount < 0) { setEditingPayment(null); return }

    const key = `${contractId}:${month}:cash`
    setSavingPayment(key)
    setEditingPayment(null)

    const res = await fetch(`/api/contracts/${contractId}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, amount }),
    })

    setSavingPayment(null)
    if (!res.ok) return

    const next = [
      ...payments.filter(p => !(p.contractId === contractId && p.month === month)),
      { contractId, month, amount },
    ]
    setPayments(next)
    onPaymentsChange(next)
  }

  const thStyle: React.CSSProperties = {
    padding: "6px 10px", fontSize: 11, fontWeight: 600, color: "#9C9590",
    textAlign: "right", whiteSpace: "nowrap", background: "#FBFAF7",
    borderBottom: "1px solid #ECE7DE", position: "sticky", top: 0,
  }
  const labelStyle: React.CSSProperties = {
    padding: "7px 10px", fontSize: 12, color: "#6B6760", whiteSpace: "nowrap",
    background: "#FBFAF7", borderRight: "1px solid #ECE7DE",
    position: "sticky", left: 0, fontWeight: 500,
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 20 }}>
      {editingContract && (
        <ContractEditModal
          contract={editingContract}
          accounts={accounts}
          clientId={clientId}
          onClose={() => setEditingContract(null)}
          onSaved={onContractUpdate}
          onAccountCreated={onAccountCreated}
        />
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1916" }}>Monthly Reconciliation</div>
          <div style={{ fontSize: 11, color: "#9C9590", marginTop: 2 }}>
            Muted = forecast · click any cell to set the amount · teal = cash received · tagged rows are Qualified / Opportunity (excluded from signed totals)
          </div>
        </div>
        <div style={{ display: "flex", gap: 2, background: "#F5F1EC", borderRadius: 6, padding: 2 }}>
          {([3, 6, 12, "all"] as const).map(n => (
            <button key={n} onClick={() => setRange(n)}
              style={{ padding: "3px 10px", fontSize: 11, fontWeight: 600, border: "none", borderRadius: 4, cursor: "pointer", background: range === n ? "#fff" : "transparent", color: range === n ? "#1A1916" : "#9C9590", boxShadow: range === n ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
              {n === "all" ? "All" : `${n}mo`}
            </button>
          ))}
        </div>
      </div>

      {/* Band filters — hide finished/etc. so the grid stays short at high volume */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#9C9590", textTransform: "uppercase", letterSpacing: "0.05em" }}>Show</span>
        {availableBands.map(b => {
          const on = bands[b.key]
          return (
            <button key={b.key} onClick={() => setBands(prev => ({ ...prev, [b.key]: !prev[b.key] }))}
              style={{ padding: "3px 10px", fontSize: 11, fontWeight: 600, borderRadius: 20, cursor: "pointer", border: on ? "1px solid #E9532A" : "1px solid #ECE7DE", background: on ? "#FDEEE9" : "#fff", color: on ? "#E9532A" : "#9C9590" }}>
              {on ? "✓ " : ""}{b.label}
            </button>
          )
        })}
      </div>

      {shownContracts.length === 0 ? (
        <div style={{ fontSize: 13, color: "#9C9590", padding: "24px 0" }}>No projects match the selected bands.</div>
      ) : (
      <div style={{ overflowX: "auto", border: "1px solid #ECE7DE", borderRadius: 10 }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "max-content" }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, textAlign: "left", position: "sticky", left: 0, zIndex: 2, minWidth: 140 }}>Account</th>
              {months.map(m => (
                <th key={m} style={{ ...thStyle, minWidth: 80, color: m === now ? "#E9532A" : "#9C9590" }}>
                  {monthLabel(m)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shownContracts.map(contract => (
              <>
                {/* Actuals row */}
                <tr key={contract.id}>
                  <td style={labelStyle}>
                    <span style={{ opacity: STATUS_TAG[contract.status] ? 0.75 : 1 }}>
                      {contract.name}
                      {(() => { const an = contract.accountId ? accounts.find(a => a.id === contract.accountId)?.name : null; return an ? ` - ${an}` : "" })()}
                    </span>
                    {STATUS_TAG[contract.status] && (
                      <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 8, background: STATUS_TAG[contract.status].bg, color: STATUS_TAG[contract.status].color, textTransform: "uppercase", letterSpacing: "0.03em", verticalAlign: "middle" }}>
                        {STATUS_TAG[contract.status].label}
                      </span>
                    )}
                    <button onClick={() => setEditingContract(contract)} title="Edit project"
                      style={{ marginLeft: 8, background: "none", border: "none", color: "#B0A9A0", cursor: "pointer", fontSize: 11, padding: 0, textDecoration: "underline", verticalAlign: "middle" }}>
                      Edit
                    </button>
                  </td>
                  {months.map(month => {
                    const active = contractActiveInMonth(contract, month)
                    const am = getActual(contract.id, month)
                    const key = `${contract.id}:${month}`
                    const isEditing = editing?.contractId === contract.id && editing?.month === month
                    const isSaving = saving === key

                    if (!active) {
                      return <td key={month} style={{ background: "#FBFAF7", borderRight: "1px solid #F5F1EC", borderBottom: "1px solid #F5F1EC" }} />
                    }

                    return (
                      <td
                        key={month}
                        style={{ borderRight: "1px solid #F5F1EC", borderBottom: "1px solid #F5F1EC", padding: 0 }}
                      >
                        {isEditing ? (
                          <input
                            autoFocus
                            defaultValue={am ? String(am.actual) : String(contract.monthly)}
                            onBlur={e => handleSave(contract.id, month, e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter") (e.target as HTMLInputElement).blur()
                              if (e.key === "Escape") setEditing(null)
                            }}
                            style={{
                              width: "100%", padding: "7px 10px", border: "none",
                              background: "#FFF7ED", fontSize: 12, color: "#1A1916",
                              fontVariantNumeric: "tabular-nums", textAlign: "right",
                              outline: "none", boxSizing: "border-box", minWidth: 80,
                            }}
                          />
                        ) : (
                          <div
                            onClick={() => setEditing({ contractId: contract.id, month })}
                            style={{
                              padding: "7px 10px", fontSize: 12, textAlign: "right",
                              cursor: "pointer", fontVariantNumeric: "tabular-nums",
                              color: am ? "#1A1916" : "#C4BFB8",
                              fontWeight: am ? 500 : 400,
                              background: isSaving ? "#FFFBE8" : month === now ? "#FFFBF7" : "transparent",
                              minWidth: 80,
                            }}
                          >
                            {fmtCurrency(am ? am.actual : contract.monthly)}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>

                {/* Cash In row */}
                <tr key={`${contract.id}-cash`} style={{ background: "#F0FDFA" }}>
                  <td style={{ ...labelStyle, color: "#0D9488", fontSize: 11, fontWeight: 400, paddingLeft: 22, background: "#F0FDFA" }}>
                    ↳ Cash In
                  </td>
                  {months.map(month => {
                    const pm = getPayment(contract.id, month)
                    const key = `${contract.id}:${month}:cash`
                    const isEditing = editingPayment?.contractId === contract.id && editingPayment?.month === month
                    const isSaving = savingPayment === key

                    return (
                      <td key={month} style={{ borderRight: "1px solid #CCFBF1", borderBottom: "1px solid #CCFBF1", padding: 0 }}>
                        {isEditing ? (
                          <input
                            autoFocus
                            defaultValue={pm ? String(pm.amount) : String(getActual(contract.id, month)?.actual ?? contract.monthly)}
                            onBlur={e => handlePaymentSave(contract.id, month, e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter") (e.target as HTMLInputElement).blur()
                              if (e.key === "Escape") setEditingPayment(null)
                            }}
                            style={{
                              width: "100%", padding: "5px 10px", border: "none",
                              background: "#CCFBF1", fontSize: 11, color: "#0F766E",
                              fontVariantNumeric: "tabular-nums", textAlign: "right",
                              outline: "none", boxSizing: "border-box", minWidth: 80,
                            }}
                          />
                        ) : (
                          <div
                            onClick={() => setEditingPayment({ contractId: contract.id, month })}
                            style={{
                              padding: "5px 10px", fontSize: 11, textAlign: "right",
                              cursor: "pointer", fontVariantNumeric: "tabular-nums",
                              color: pm ? "#0F766E" : contractActiveInMonth(contract, month) ? "#99D6CE" : "#A7D8D2",
                              fontWeight: pm ? 600 : 400,
                              background: isSaving ? "#CCFBF1" : "transparent",
                              minWidth: 80,
                            }}
                          >
                            {pm
                              ? fmtCurrency(pm.amount)
                              : contractActiveInMonth(contract, month)
                                ? fmtCurrency(getActual(contract.id, month)?.actual ?? contract.monthly)
                                : "—"}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              </>
            ))}

            {/* Total MRR row — signed (contracted) only */}
            <tr style={{ background: "#F8F6F2" }}>
              <td style={{ ...labelStyle, fontWeight: 700, color: "#1A1916", background: "#F8F6F2" }}>Total MRR</td>
              {months.map(month => {
                let total = 0
                for (const c of signedContracts) {
                  if (!contractActiveInMonth(c, month)) continue
                  const am = getActual(c.id, month)
                  total += am ? am.actual : c.monthly
                }
                return (
                  <td key={month} style={{ padding: "7px 10px", textAlign: "right", fontSize: 12, fontWeight: 700, color: "#1A1916", fontVariantNumeric: "tabular-nums", borderRight: "1px solid #F5F1EC", background: month === now ? "#FFF8F5" : "transparent" }}>
                    {fmtCurrency(total)}
                  </td>
                )
              })}
            </tr>

            {/* Projected row — all bands, incl. Qualified + Opportunity (shown only if any exist) */}
            {shownContracts.length > signedContracts.length && (
              <tr style={{ background: "#FBFAF7" }}>
                <td style={{ ...labelStyle, fontWeight: 600, color: "#6B6760", background: "#FBFAF7" }}>Projected · all bands</td>
                {months.map(month => {
                  let total = 0
                  for (const c of shownContracts) {
                    if (!contractActiveInMonth(c, month)) continue
                    const am = getActual(c.id, month)
                    total += am ? am.actual : c.monthly
                  }
                  return (
                    <td key={month} style={{ padding: "7px 10px", textAlign: "right", fontSize: 12, fontWeight: 600, color: "#6B6760", fontVariantNumeric: "tabular-nums", borderRight: "1px solid #F5F1EC", background: month === now ? "#FFF8F5" : "transparent" }}>
                      {fmtCurrency(total)}
                    </td>
                  )
                })}
              </tr>
            )}

            {/* Total Cash row */}
            <tr style={{ background: "#F0FDFA" }}>
              <td style={{ ...labelStyle, fontWeight: 700, color: "#0D9488", background: "#F0FDFA" }}>Total Cash In</td>
              {months.map(month => {
                const total = signedContracts.reduce((sum, c) => {
                  if (!contractActiveInMonth(c, month)) return sum
                  const pm = getPayment(c.id, month)
                  return sum + (pm ? pm.amount : (getActual(c.id, month)?.actual ?? c.monthly))
                }, 0)
                const isOverridden = signedContracts.some(c => contractActiveInMonth(c, month) && getPayment(c.id, month))
                return (
                  <td key={month} style={{ padding: "7px 10px", textAlign: "right", fontSize: 12, fontWeight: 700, color: isOverridden ? "#0D9488" : "#99D6CE", fontVariantNumeric: "tabular-nums", borderRight: "1px solid #CCFBF1", background: "transparent" }}>
                    {fmtCurrency(total)}
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>
      )}
    </div>
  )
}
