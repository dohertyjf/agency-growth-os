"use client"
import { useEffect, useRef, useState } from "react"
import { leadsGoal } from "@/lib/calc"
import LeadGoalResults from "@/components/LeadGoalResults"

type Currency = "USD" | "GBP" | "EUR"
function currSym(c: Currency) { return c === "GBP" ? "£" : c === "EUR" ? "€" : "$" }

const accent = "#E9532A"
// John's Google Appointment Scheduling page, embedded in the booking modal.
const BOOKING_URL = "https://calendar.google.com/calendar/appointments/schedules/AcZssZ1KAcVxnxyAbVyWshakSOwQcGXhbYtzndKY1NBI0cP79r8QjDOZoI1xJMVy8KkdEEjXcwkO8sAy?gv=true"
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "#6B6760", display: "block", marginBottom: 4 }
const fieldStyle: React.CSSProperties = { display: "flex", flexDirection: "column" }
const inputWrap: React.CSSProperties = { marginTop: "auto" }
const inputStyle: React.CSSProperties = {
  padding: "8px 11px", border: "1px solid #ECE7DE", borderRadius: 8, fontSize: 14,
  background: "#FCFBF8", color: "#1A1916", width: "100%", boxSizing: "border-box", fontFamily: "inherit", outline: "none",
}

function MoneyInput({ sym, value, onChange, step = 500, onBlur }: { sym: string; value: string; onChange: (s: string) => void; step?: number; onBlur?: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", border: "1px solid #ECE7DE", borderRadius: 8, background: "#FCFBF8" }}>
      <span style={{ padding: "0 2px 0 11px", fontSize: 14, color: "#9C9590", flexShrink: 0, userSelect: "none" }}>{sym}</span>
      <input type="number" min={0} step={step} value={value} onChange={e => onChange(e.target.value)} onBlur={onBlur}
        style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: "inherit", fontSize: 14, color: "#1A1916", padding: "8px 11px 8px 4px", width: "100%", boxSizing: "border-box" }} />
    </div>
  )
}

interface Props {
  embed?: boolean
  prefill?: { name?: string; email?: string; agency?: string }
}

export default function LeadGoalCalculator({ embed = false, prefill }: Props) {
  const [currency, setCurrency] = useState<Currency>("USD")
  const sym = currSym(currency)

  const [currentRevenueStr, setCurrentRevenueStr] = useState("10000")
  const [goalRevenueStr, setGoalRevenueStr] = useState("25000")
  const [closedPer10Str, setClosedPer10Str] = useState("3")
  const [avgDealStr, setAvgDealStr] = useState("2500")
  const [recurringStr, setRecurringStr] = useState("8000")
  const [salesConvosStr, setSalesConvosStr] = useState("")
  const [months, setMonths] = useState(12)

  const [name, setName] = useState(prefill?.name ?? "")
  const [email, setEmail] = useState(prefill?.email ?? "")
  const [agency, setAgency] = useState(prefill?.agency ?? "")
  const [honeypot, setHoneypot] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [showCapture, setShowCapture] = useState(false)
  const [captured, setCaptured] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  const num = (s: string) => { const n = parseFloat(s); return isNaN(n) ? 0 : n }
  const currentRevenue = num(currentRevenueStr)
  const goalRevenue = num(goalRevenueStr)
  const avgDeal = num(avgDealStr)
  const recurring = num(recurringStr)
  const cr = Math.min(10, Math.max(0, num(closedPer10Str))) / 10
  const currentLeads = salesConvosStr.trim() === "" ? null : num(salesConvosStr)

  const clampRecurring = () => {
    if (num(recurringStr) > currentRevenue) setRecurringStr(String(currentRevenue))
  }

  const r = leadsGoal({ currentRevenue, goalRevenue, closeRate: cr, avgDealValue: avgDeal, recurringRevenue: recurring, currentLeads, months })

  // ── Embed: auto-report height to the parent page ──────────────────────────
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!embed || typeof window === "undefined") return
    const post = () => {
      const h = rootRef.current?.scrollHeight ?? document.body.scrollHeight
      window.parent.postMessage({ type: "jd-calc:height", height: h }, "*")
    }
    post()
    const ro = new ResizeObserver(post)
    if (rootRef.current) ro.observe(rootRef.current)
    return () => ro.disconnect()
  })

  // Tell the embed to go full-screen while the booking modal is open so it
  // centers on the real viewport instead of being trapped inside the iframe.
  useEffect(() => {
    if (!embed || typeof window === "undefined") return
    window.parent.postMessage({ type: "jd-calc:modal", open: modalOpen }, "*")
  }, [embed, modalOpen])

  function openCapture() {
    if (salesConvosStr.trim() === "") {
      setError("Please enter your sales conversations per month (enter 0 if none).")
      return
    }
    setError("")
    setShowCapture(true)
  }

  async function submit() {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.")
      return
    }
    setError("")
    setSubmitting(true)
    try {
      const res = await fetch("/api/lead-goal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email, name: name || undefined, agency: agency || undefined, currency,
          inputs: { currentRevenue, goalRevenue, closeRate: cr, avgDealValue: avgDeal, recurringRevenue: recurring, currentLeads: currentLeads ?? 0 },
          honeypot,
        }),
      })
      if (res.ok) {
        setCaptured(true)
        setModalOpen(true)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div ref={rootRef} style={{ background: "#FBFAF7", padding: embed ? "24px 18px" : "40px 24px" }}>
      <div style={{ maxWidth: 940, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 32, fontWeight: 600, margin: "0 0 8px", color: "#1A1916", lineHeight: 1.15 }}>
              How many leads do you need to hit your goal?
            </h1>
            <p style={{ fontSize: 15, color: "#6F6B64", margin: 0, maxWidth: 620, lineHeight: 1.55 }}>
              Answer a few questions about your numbers and we&apos;ll show the sales conversations per
              month it takes to reach — and hold — your revenue goal.
            </p>
          </div>
          <select value={currency} onChange={e => setCurrency(e.target.value as Currency)}
            style={{ ...inputStyle, width: "auto", padding: "8px 12px", cursor: "pointer" }} aria-label="Currency">
            <option value="USD">$ USD</option><option value="GBP">£ GBP</option><option value="EUR">€ EUR</option>
          </select>
        </div>

        {/* Inputs (always editable) */}
        <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 16 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>What did you collect in revenue last month?</label>
              <div style={inputWrap}><MoneyInput sym={sym} value={currentRevenueStr} onChange={setCurrentRevenueStr} onBlur={clampRecurring} /></div>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>What&apos;s your target monthly revenue?</label>
              <div style={inputWrap}><MoneyInput sym={sym} value={goalRevenueStr} onChange={setGoalRevenueStr} step={1000} /></div>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Out of 10 sales conversations, how many do you close?</label>
              <div style={inputWrap}>
                <input style={inputStyle} type="number" min={0} max={10} step={0.5} value={closedPer10Str}
                  onChange={e => setClosedPer10Str(e.target.value)} />
              </div>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Avg revenue a new client brings their first month?</label>
              <div style={inputWrap}><MoneyInput sym={sym} value={avgDealStr} onChange={setAvgDealStr} step={250} /></div>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>How much of last month&apos;s revenue bills again this month?</label>
              <div style={inputWrap}><MoneyInput sym={sym} value={recurringStr} onChange={setRecurringStr} onBlur={clampRecurring} /></div>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Sales conversations per month <span style={{ color: "#B8B2A8", fontWeight: 400 }}>(your qualified leads)</span></label>
              <div style={inputWrap}>
                <input style={inputStyle} type="number" min={0} step={1} value={salesConvosStr}
                  onChange={e => { setSalesConvosStr(e.target.value); setError("") }} placeholder="e.g. 8" />
              </div>
            </div>
          </div>
        </div>

        {/* Pre-capture gate, or post-capture results */}
        {!captured ? (
          !showCapture ? (
            <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
              <button onClick={openCapture}
                style={{ fontSize: 16, fontWeight: 600, color: "#fff", background: accent, border: "none", borderRadius: 10, padding: "15px 34px", cursor: "pointer" }}>
                See your results →
              </button>
              {error && <div style={{ fontSize: 13, color: "#C2410C", marginTop: 10 }}>{error}</div>}
              <p style={{ fontSize: 13, color: "#9C9590", margin: "12px auto 0", maxWidth: 460, lineHeight: 1.5 }}>
                Tell us where to send your results and you can explore the numbers live.
              </p>
            </div>
          ) : (
            <form onSubmit={e => { e.preventDefault(); submit() }}
              style={{ background: "#1A1916", borderRadius: 14, padding: "26px 24px", color: "#fff" }}>
              <h3 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 24, fontWeight: 600, margin: "0 0 6px" }}>
                Where should we send your results?
              </h3>
              <p style={{ fontSize: 14, color: "#C9C4BC", margin: "0 0 20px", lineHeight: 1.55, maxWidth: 560 }}>
                Enter your details to unlock your results — then play with the numbers as much as you like.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 14 }}>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
                  name="name" autoComplete="name"
                  style={{ ...inputStyle, background: "#2A2824", border: "1px solid #3A3833", color: "#fff" }} />
                <input value={email} onChange={e => { setEmail(e.target.value); setError("") }} type="email" placeholder="you@agency.com"
                  name="email" autoComplete="email"
                  style={{ ...inputStyle, background: "#2A2824", border: `1px solid ${error ? "#C2410C" : "#3A3833"}`, color: "#fff" }} />
                <input value={agency} onChange={e => setAgency(e.target.value)} placeholder="Agency name"
                  name="organization" autoComplete="organization"
                  style={{ ...inputStyle, background: "#2A2824", border: "1px solid #3A3833", color: "#fff" }} />
              </div>
              <input value={honeypot} onChange={e => setHoneypot(e.target.value)} tabIndex={-1} autoComplete="off"
                aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} />
              {error && <div style={{ fontSize: 12, color: "#F0A088", marginBottom: 10 }}>{error}</div>}
              <button type="submit" disabled={submitting}
                style={{ fontSize: 14, fontWeight: 600, color: "#fff", background: accent, border: "none", borderRadius: 9, padding: "12px 24px", cursor: submitting ? "default" : "pointer", opacity: submitting ? 0.7 : 1 }}>
                {submitting ? "Sending…" : "Show my results →"}
              </button>
            </form>
          )
        ) : (
          <>
            {/* Book-a-call banner */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", background: "#FBF0EB", border: "1px solid #F0C3B0", borderRadius: 12, padding: "14px 18px", marginBottom: 20 }}>
              <div style={{ fontSize: 14, color: "#1A1916", lineHeight: 1.45 }}>
                <strong>Want to walk through this live with John?</strong> Book a free Leads Strategy Call.
              </div>
              <button onClick={() => setModalOpen(true)}
                style={{ flexShrink: 0, fontSize: 14, fontWeight: 700, color: "#fff", background: accent, border: "none", borderRadius: 9, padding: "11px 20px", cursor: "pointer" }}>
                Book a call →
              </button>
            </div>

            <LeadGoalResults
              r={r}
              goalRevenue={goalRevenue}
              currentLeads={currentLeads}
              months={months}
              setMonths={setMonths}
              currency={currency}
            />
          </>
        )}
      </div>

      {/* Booking modal */}
      {modalOpen && (
        <div onClick={() => setModalOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(26,25,22,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 16, maxWidth: 760, width: "100%", maxHeight: "92vh", overflow: "auto", position: "relative", boxShadow: "0 12px 48px rgba(0,0,0,0.28)" }}>
            <button onClick={() => setModalOpen(false)} aria-label="Close"
              style={{ position: "absolute", top: 12, right: 12, width: 32, height: 32, borderRadius: "50%", border: "none", background: "#F0EDE8", color: "#1A1916", fontSize: 18, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}>
              ×
            </button>
            <div style={{ padding: "28px 28px 12px", textAlign: "center" }}>
              <h3 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 26, fontWeight: 600, margin: "0 0 8px", color: "#1A1916" }}>Your results are ready 🎉</h3>
              <p style={{ fontSize: 14, color: "#6F6B64", margin: "0 auto", maxWidth: 520, lineHeight: 1.55 }}>
                Book a free Growth Projection Review Call and John will walk you through your numbers and the fastest path to your goal — or close this to explore the results yourself.
              </p>
            </div>
            <div style={{ padding: "8px 20px 22px" }}>
              <iframe src={BOOKING_URL} title="Book a call"
                style={{ width: "100%", height: 600, border: "1px solid #ECE7DE", borderRadius: 10, background: "#FBFAF7" }} />
              <div style={{ textAlign: "center", marginTop: 12, display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
                <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: accent, fontWeight: 600 }}>Open the booking page in a new tab →</a>
                <button onClick={() => setModalOpen(false)} style={{ fontSize: 13, color: "#9C9590", background: "none", border: "none", cursor: "pointer" }}>I&apos;ll explore first</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
