"use client"
import { useState } from "react"
import { fmtCurrency } from "@/lib/calc"

interface Contract {
  id: string
  name: string
  monthly: number
  start: string
  contractedThrough: string | null
  status: string
  type: string
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
  initialAccountMonths: AccountMonth[]
  initialPayments: Payment[]
  onRevenueUpdate: (month: string, revenue: number) => void
  onPaymentsChange: (payments: Payment[]) => void
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

function ymAdd(ym: string, months: number): string {
  const [y, m] = ym.split("-").map(Number)
  const total = y * 12 + m - 1 + months
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`
}

export default function ReconciliationTable({ contracts, initialAccountMonths, initialPayments, onRevenueUpdate, onPaymentsChange }: Props) {
  const [accountMonths, setAccountMonths] = useState<AccountMonth[]>(initialAccountMonths)
  const [payments, setPayments] = useState<Payment[]>(initialPayments)
  const [editing, setEditing] = useState<{ contractId: string; month: string } | null>(null)
  const [editingPayment, setEditingPayment] = useState<{ contractId: string; month: string } | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [savingPayment, setSavingPayment] = useState<string | null>(null)
  const [range, setRange] = useState<3 | 6 | 12 | "all">("all")

  const activeContracts = contracts.filter(c => c.status === "active" || c.status === "finished")
  if (activeContracts.length === 0) return null

  const allEnds = activeContracts.map(c => c.contractedThrough ?? now)
  const rangeEnd = [now, ...allEnds].reduce((a, b) => a > b ? a : b)

  const windowStart = range === "all"
    ? activeContracts.map(c => c.start).reduce((a, b) => a < b ? a : b)
    : ymAdd(now, -(range - 1))

  // Extend one month back if there are early cash payments
  const hasEarlyPayment = payments.some(p => p.month < windowStart)
  const effectiveStart = hasEarlyPayment ? ymAdd(windowStart, -1) : windowStart

  const allMonths = monthsBetween(effectiveStart, rangeEnd)
  // Only show months where at least one contract is active
  const months = allMonths.filter(m => activeContracts.some(c => contractActiveInMonth(c, m)))

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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1916" }}>Monthly Reconciliation</div>
          <div style={{ fontSize: 11, color: "#9C9590", marginTop: 2 }}>
            Forecast in muted · click to enter actual · teal row = cash received
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
            {activeContracts.map(contract => (
              <>
                {/* Actuals row */}
                <tr key={contract.id}>
                  <td style={labelStyle}>{contract.name}</td>
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

            {/* Total MRR row */}
            <tr style={{ background: "#F8F6F2" }}>
              <td style={{ ...labelStyle, fontWeight: 700, color: "#1A1916", background: "#F8F6F2" }}>Total MRR</td>
              {months.map(month => {
                let total = 0
                for (const c of activeContracts) {
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

            {/* Total Cash row */}
            <tr style={{ background: "#F0FDFA" }}>
              <td style={{ ...labelStyle, fontWeight: 700, color: "#0D9488", background: "#F0FDFA" }}>Total Cash In</td>
              {months.map(month => {
                const total = activeContracts.reduce((sum, c) => {
                  if (!contractActiveInMonth(c, month)) return sum
                  const pm = getPayment(c.id, month)
                  return sum + (pm ? pm.amount : (getActual(c.id, month)?.actual ?? c.monthly))
                }, 0)
                const isOverridden = activeContracts.some(c => contractActiveInMonth(c, month) && getPayment(c.id, month))
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
    </div>
  )
}
