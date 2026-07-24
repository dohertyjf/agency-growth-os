"use client"
import { useState } from "react"
import { fmtCurrency } from "@/lib/calc"

interface Goal {
  monthlyRevenue: number
  netProfitPct: number
  closeRatePct: number
}

interface Props {
  clientId: string
  initialGoal: Goal | null
}

const inputStyle: React.CSSProperties = {
  padding: "8px 12px", border: "1px solid #ECE7DE", borderRadius: 6,
  fontSize: 14, background: "#fff", color: "#1A1916",
  width: "100%", boxSizing: "border-box", fontFamily: "inherit", outline: "none",
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: "#9C9590", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 14, paddingBottom: 8, borderBottom: "1px solid #ECE7DE" }}>
      {children}
    </div>
  )
}

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <label style={{ fontSize: 11, fontWeight: 600, color: "#6B6760", display: "block", marginBottom: 6 }}>
      {children}
      {hint && <span style={{ fontWeight: 400, color: "#C0BAB2", marginLeft: 6 }}>{hint}</span>}
    </label>
  )
}

function Derived({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: "8px 12px", background: "#F5F1EC", borderRadius: 6, fontSize: 14, color: "#6B6760", fontVariantNumeric: "tabular-nums" }}>
      <span style={{ fontSize: 11, color: "#9C9590", display: "block", marginBottom: 2 }}>{label}</span>
      {value}
    </div>
  )
}

export default function GoalsPanel({ clientId, initialGoal }: Props) {
  const [monthly, setMonthly] = useState(String(initialGoal?.monthlyRevenue || ""))
  const [netProfitPct, setNetProfitPct] = useState(String(initialGoal?.netProfitPct || ""))
  const [closeRatePct, setCloseRatePct] = useState(String(initialGoal?.closeRatePct || ""))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const monthlyNum = parseFloat(monthly) || 0
  const annualNum = monthlyNum * 12
  const netProfitPctNum = parseFloat(netProfitPct) || 0
  const monthlyNetProfit = monthlyNum * (netProfitPctNum / 100)
  const closeRatePctNum = parseFloat(closeRatePct) || 0

  function handleAnnualChange(val: string) {
    const n = parseFloat(val) || 0
    setMonthly(n ? String(Math.round(n / 12)) : "")
  }

  function handleMonthlyNetProfitChange(val: string) {
    const n = parseFloat(val) || 0
    if (monthlyNum > 0) {
      setNetProfitPct(String(Math.round((n / monthlyNum) * 1000) / 10))
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/clients/${clientId}/goal`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyRevenue: monthlyNum, netProfitPct: netProfitPctNum, closeRatePct: closeRatePctNum }),
      })
      if (!res.ok) throw new Error("Save failed")
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError("Failed to save. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSave}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>

        {/* Revenue */}
        <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 20 }}>
          <SectionLabel>Revenue</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <FieldLabel>Monthly Revenue Goal</FieldLabel>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#9C9590" }}>$</span>
                <input style={{ ...inputStyle, paddingLeft: 22 }} type="number" min={0} step={100}
                  value={monthly} onChange={e => setMonthly(e.target.value)} placeholder="50000" />
              </div>
            </div>
            <div>
              <FieldLabel hint="auto">Annual Revenue Goal</FieldLabel>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#9C9590" }}>$</span>
                <input style={{ ...inputStyle, paddingLeft: 22 }} type="number" min={0} step={1000}
                  value={annualNum || ""}
                  onChange={e => handleAnnualChange(e.target.value)}
                  placeholder={monthlyNum ? String(annualNum) : "600000"} />
              </div>
            </div>
          </div>
          {monthlyNum > 0 && (
            <div style={{ marginTop: 12, fontSize: 12, color: "#9C9590" }}>
              {fmtCurrency(monthlyNum)}/mo → {fmtCurrency(annualNum)}/yr
            </div>
          )}
        </div>

        {/* Profitability */}
        <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 20 }}>
          <SectionLabel>Profitability</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <FieldLabel>Net Profit Target</FieldLabel>
              <div style={{ position: "relative" }}>
                <input style={{ ...inputStyle, paddingRight: 22 }} type="number" min={0} max={100} step={0.5}
                  value={netProfitPct} onChange={e => setNetProfitPct(e.target.value)} placeholder="25" />
                <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#9C9590" }}>%</span>
              </div>
            </div>
            <div>
              <FieldLabel hint="auto">Monthly Net Profit $</FieldLabel>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#9C9590" }}>$</span>
                <input style={{ ...inputStyle, paddingLeft: 22 }} type="number" min={0} step={100}
                  value={monthlyNetProfit ? String(Math.round(monthlyNetProfit)) : ""}
                  onChange={e => handleMonthlyNetProfitChange(e.target.value)}
                  placeholder={monthlyNum && netProfitPctNum ? String(Math.round(monthlyNetProfit)) : "12500"} />
              </div>
            </div>
          </div>
          {netProfitPctNum > 0 && monthlyNum > 0 && (
            <div style={{ marginTop: 12, fontSize: 12, color: "#9C9590" }}>
              {netProfitPctNum}% of {fmtCurrency(monthlyNum)} = {fmtCurrency(monthlyNetProfit)}/mo net profit
            </div>
          )}
        </div>

        {/* Sales */}
        <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 20 }}>
          <SectionLabel>Sales</SectionLabel>
          <div style={{ maxWidth: 200 }}>
            <FieldLabel>Close Rate Target</FieldLabel>
            <div style={{ position: "relative" }}>
              <input style={{ ...inputStyle, paddingRight: 22 }} type="number" min={0} max={100} step={1}
                value={closeRatePct} onChange={e => setCloseRatePct(e.target.value)} placeholder="50" />
              <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#9C9590" }}>%</span>
            </div>
          </div>
        </div>

        {/* Summary */}
        {(monthlyNum > 0 || netProfitPctNum > 0 || closeRatePctNum > 0) && (
          <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 20 }}>
            <SectionLabel>Summary</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {monthlyNum > 0 && (
                <Derived label="Monthly Revenue Goal" value={fmtCurrency(monthlyNum) + "/mo · " + fmtCurrency(annualNum) + "/yr"} />
              )}
              {netProfitPctNum > 0 && (
                <Derived
                  label="Net Profit Target"
                  value={netProfitPctNum + "%" + (monthlyNum > 0 ? " · " + fmtCurrency(monthlyNetProfit) + "/mo" : "")}
                />
              )}
              {closeRatePctNum > 0 && (
                <Derived label="Close Rate Target" value={closeRatePctNum + "%"} />
              )}
            </div>
          </div>
        )}

      </div>

      <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 12 }}>
        <button type="submit" disabled={saving}
          style={{ padding: "9px 24px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          {saving ? "Saving…" : "Save Goals"}
        </button>
        {saved && <span style={{ fontSize: 13, color: "#1F7A4D", fontWeight: 600 }}>Saved</span>}
        {error && <span style={{ fontSize: 13, color: "#C2410C" }}>{error}</span>}
      </div>
    </form>
  )
}
