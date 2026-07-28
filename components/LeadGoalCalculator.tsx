"use client"
import { useState } from "react"
import { leadsGoal, fmtCurrency } from "@/lib/calc"

type Currency = "USD" | "GBP" | "EUR"
function currSym(c: Currency) { return c === "GBP" ? "£" : c === "EUR" ? "€" : "$" }

const accent = "#E9532A"
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "#6B6760", display: "block", marginBottom: 4 }
const inputStyle: React.CSSProperties = {
  padding: "8px 11px", border: "1px solid #ECE7DE", borderRadius: 8, fontSize: 14,
  background: "#FCFBF8", color: "#1A1916", width: "100%", boxSizing: "border-box", fontFamily: "inherit", outline: "none",
}

function MoneyInput({ sym, value, onChange, step = 500 }: { sym: string; value: number; onChange: (n: number) => void; step?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", border: "1px solid #ECE7DE", borderRadius: 8, background: "#FCFBF8" }}>
      <span style={{ padding: "0 2px 0 11px", fontSize: 14, color: "#9C9590", flexShrink: 0, userSelect: "none" }}>{sym}</span>
      <input type="number" min={0} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value) || 0)}
        style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: "inherit", fontSize: 14, color: "#1A1916", padding: "8px 11px 8px 4px", width: "100%", boxSizing: "border-box" }} />
    </div>
  )
}

export default function LeadGoalCalculator() {
  const [currency, setCurrency] = useState<Currency>("USD")
  const sym = currSym(currency)
  const fmt$ = (v: number) => fmtCurrency(v, currency)

  const [currentRevenue, setCurrentRevenue] = useState(10000)
  const [goalRevenue, setGoalRevenue] = useState(25000)
  const [closedPer10, setClosedPer10] = useState(3)
  const [avgDeal, setAvgDeal] = useState(2500)
  const [recurring, setRecurring] = useState(8000)
  const [currentLeadsStr, setCurrentLeadsStr] = useState("")
  const [months, setMonths] = useState(12)

  const currentLeads = currentLeadsStr.trim() === "" ? null : parseFloat(currentLeadsStr) || 0
  const cr = Math.min(10, Math.max(0, closedPer10)) / 10

  const r = leadsGoal({
    currentRevenue, goalRevenue, closeRate: cr, avgDealValue: avgDeal,
    recurringRevenue: recurring, currentLeads, months,
  })

  const needed = Math.ceil(r.leadsToReachGoal)
  const treadmill = Math.round(r.leadsToHoldCurrent)

  return (
    <div style={{ background: "#FBFAF7", padding: "40px 24px" }}>
      <div style={{ maxWidth: 940, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 32, fontWeight: 600, margin: "0 0 8px", color: "#1A1916", lineHeight: 1.15 }}>
              How many leads do you need to hit your goal?
            </h1>
            <p style={{ fontSize: 15, color: "#6F6B64", margin: 0, maxWidth: 620, lineHeight: 1.55 }}>
              Answer a few questions about your numbers and we&apos;ll show the qualified leads per
              month it takes to reach — and hold — your revenue goal.
            </p>
          </div>
          <select value={currency} onChange={e => setCurrency(e.target.value as Currency)}
            style={{ ...inputStyle, width: "auto", padding: "8px 12px", cursor: "pointer" }} aria-label="Currency">
            <option value="USD">$ USD</option><option value="GBP">£ GBP</option><option value="EUR">€ EUR</option>
          </select>
        </div>

        {/* Inputs */}
        <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 16 }}>
            <div>
              <label style={labelStyle}>What did you collect in revenue last month?</label>
              <MoneyInput sym={sym} value={currentRevenue} onChange={setCurrentRevenue} />
            </div>
            <div>
              <label style={labelStyle}>What&apos;s your target monthly revenue?</label>
              <MoneyInput sym={sym} value={goalRevenue} onChange={setGoalRevenue} step={1000} />
            </div>
            <div>
              <label style={labelStyle}>Out of 10 qualified prospects, how many do you close?</label>
              <input style={inputStyle} type="number" min={0} max={10} step={0.5} value={closedPer10}
                onChange={e => setClosedPer10(parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label style={labelStyle}>Avg revenue a new client brings their first month?</label>
              <MoneyInput sym={sym} value={avgDeal} onChange={setAvgDeal} step={250} />
            </div>
            <div>
              <label style={labelStyle}>Of that revenue, how much bills again next month (no new sale)?</label>
              <MoneyInput sym={sym} value={recurring} onChange={setRecurring} />
            </div>
            <div>
              <label style={labelStyle}>Qualified leads you get per month <span style={{ color: "#B8B2A8", fontWeight: 400 }}>(optional)</span></label>
              <input style={inputStyle} type="number" min={0} step={1} value={currentLeadsStr}
                onChange={e => setCurrentLeadsStr(e.target.value)} placeholder="e.g. 8" />
            </div>
          </div>
        </div>

        {!r.valid ? (
          <div style={{ background: "#FBF0EB", border: "1px solid #F0C3B0", borderRadius: 12, padding: 20, fontSize: 14, color: "#9A3412" }}>
            Enter a close rate and an average deal size to calculate.
          </div>
        ) : (
          <>
            {/* Timeframe slider */}
            <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: "16px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#1A1916", whiteSpace: "nowrap" }}>Reach it in</label>
              <input type="range" min={3} max={24} step={1} value={months} onChange={e => setMonths(parseInt(e.target.value))}
                style={{ flex: 1, minWidth: 160, accentColor: accent }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: accent, minWidth: 78, textAlign: "right" }}>{months} months</span>
            </div>

            {/* Headline */}
            <div style={{ background: "#1A1916", borderRadius: 14, padding: "26px 24px", color: "#fff", marginBottom: 16 }}>
              {r.goalBelowCurrent ? (
                <div style={{ fontSize: 18, lineHeight: 1.4 }}>
                  You&apos;re already past {fmt$(goalRevenue)}/mo. To <strong>hold</strong> it, you need{" "}
                  <span style={{ color: "#F4A47F", fontWeight: 800, fontSize: 22 }}>{Math.ceil(r.leadsToHoldGoal)} qualified leads/mo</span>.
                </div>
              ) : (
                <div style={{ fontSize: 18, lineHeight: 1.4 }}>
                  To reach <strong>{fmt$(goalRevenue)}/mo</strong> in <strong>{months} months</strong>, you need{" "}
                  <span style={{ color: "#F4A47F", fontWeight: 800, fontSize: 26 }}>{needed} qualified leads/month</span>.
                </div>
              )}
              <div style={{ fontSize: 13, color: "#C9C4BC", marginTop: 10, lineHeight: 1.5 }}>
                ≈ {r.newClientsPerMonth.toFixed(1)} new clients/mo.
                {treadmill > 0 && !r.goalBelowCurrent && <> Of those {needed} leads, about <strong style={{ color: "#fff" }}>{treadmill} just replace what rolls off</strong> — only {Math.max(0, needed - treadmill)} actually grow you.</>}
              </div>
            </div>

            {/* Gap + ceiling (only when current leads provided) */}
            {currentLeads != null && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 16 }}>
                <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#9C9590", marginBottom: 6 }}>The gap</div>
                  {r.alreadyEnoughLeads ? (
                    <div style={{ fontSize: 14, color: "#1A1916", lineHeight: 1.5 }}>
                      You already generate enough leads. The constraint isn&apos;t lead volume — it&apos;s your <strong>close rate, retention, or deal size</strong>.
                    </div>
                  ) : (
                    <div style={{ fontSize: 14, color: "#1A1916", lineHeight: 1.5 }}>
                      You get <strong>{currentLeads}</strong>/mo → you&apos;re{" "}
                      <strong style={{ color: accent }}>{Math.ceil(r.gap as number)} leads/mo short</strong>.
                    </div>
                  )}
                </div>
                <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#9C9590", marginBottom: 6 }}>Your ceiling at {currentLeads} leads/mo</div>
                  {r.ceilingAtCurrentLeads == null ? (
                    <div style={{ fontSize: 14, color: "#1F7A4D", lineHeight: 1.5 }}>No ceiling — with nothing rolling off, your revenue compounds.</div>
                  ) : (
                    <div style={{ fontSize: 14, color: "#1A1916", lineHeight: 1.5 }}>
                      Revenue plateaus at <strong style={{ color: r.reachesGoalAtCurrentLeads ? "#1F7A4D" : "#C2410C" }}>{fmt$(r.ceilingAtCurrentLeads)}/mo</strong> —{" "}
                      {r.reachesGoalAtCurrentLeads ? "enough for your goal." : "below your goal. More leads alone won't get you there."}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Roll-off + runway */}
            <div style={{ background: "#F5F1EC", borderRadius: 12, padding: "14px 18px", fontSize: 13, color: "#6B6760", lineHeight: 1.6 }}>
              <strong style={{ color: "#1A1916" }}>{fmt$(r.rollOff)}/mo</strong> of your revenue rolls off ({Math.round(r.churnRate * 100)}% doesn&apos;t recur).
              {r.runwayHalfLifeMonths != null && <> Stop selling entirely and your revenue would halve in about <strong style={{ color: "#1A1916" }}>{r.runwayHalfLifeMonths.toFixed(1)} months</strong>.</>}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
