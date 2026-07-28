"use client"
import { useEffect, useRef, useState } from "react"

type Currency = "USD" | "GBP" | "EUR"
function currSym(c: Currency) { return c === "GBP" ? "£" : c === "EUR" ? "€" : "$" }

const accent = "#E9532A"
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
  schedulingUrl?: string
}

export default function LeadGoalCalculator({ embed = false, schedulingUrl = "" }: Props) {
  const [currency, setCurrency] = useState<Currency>("USD")
  const sym = currSym(currency)

  // Inputs as text so cleared fields stay empty (no stray "0").
  const [currentRevenueStr, setCurrentRevenueStr] = useState("10000")
  const [goalRevenueStr, setGoalRevenueStr] = useState("25000")
  const [closedPer10Str, setClosedPer10Str] = useState("3")
  const [avgDealStr, setAvgDealStr] = useState("2500")
  const [recurringStr, setRecurringStr] = useState("8000")
  const [salesConvosStr, setSalesConvosStr] = useState("")

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [agency, setAgency] = useState("")
  const [honeypot, setHoneypot] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [showCapture, setShowCapture] = useState(false)

  const num = (s: string) => { const n = parseFloat(s); return isNaN(n) ? 0 : n }
  const currentRevenue = num(currentRevenueStr)

  const clampRecurring = () => {
    if (num(recurringStr) > currentRevenue) setRecurringStr(String(currentRevenue))
  }

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
          inputs: {
            currentRevenue, goalRevenue: num(goalRevenueStr),
            closeRate: Math.min(10, Math.max(0, num(closedPer10Str))) / 10,
            avgDealValue: num(avgDealStr), recurringRevenue: num(recurringStr),
            currentLeads: num(salesConvosStr),
          },
          honeypot,
        }),
      })
      if (res.ok) {
        if (schedulingUrl) {
          if (embed && window.parent !== window) window.parent.postMessage({ type: "jd-calc:redirect", url: schedulingUrl }, "*")
          else window.location.href = schedulingUrl
        } else {
          setSubmitted(true)
        }
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div ref={rootRef} style={{ background: "#FBFAF7", padding: embed ? "48px 24px" : "80px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div style={{ width: 56, height: 56, margin: "0 auto 20px", borderRadius: 14, background: accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <h2 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 30, fontWeight: 600, margin: "0 0 12px", color: "#1A1916" }}>Thanks — you&apos;re in.</h2>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: "#6F6B64" }}>
            John will personally review your numbers and send your lead plan to <strong>{email}</strong>.
          </p>
        </div>
      </div>
    )
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
              Answer a few questions about your numbers and John will send you a personalized lead
              plan — the sales conversations per month it takes to reach and hold your revenue goal.
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

        {/* Gate: results are hidden until they submit */}
        {!showCapture ? (
          <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
            <button onClick={openCapture}
              style={{ fontSize: 16, fontWeight: 600, color: "#fff", background: accent, border: "none", borderRadius: 10, padding: "15px 34px", cursor: "pointer" }}>
              Get your lead plan →
            </button>
            {error && <div style={{ fontSize: 13, color: "#C2410C", marginTop: 10 }}>{error}</div>}
            <p style={{ fontSize: 13, color: "#9C9590", margin: "12px auto 0", maxWidth: 460, lineHeight: 1.5 }}>
              John will personally review your numbers and send your lead plan — how many leads a
              month you need, and where the real constraint is.
            </p>
          </div>
        ) : (
          <div style={{ background: "#1A1916", borderRadius: 14, padding: "26px 24px", color: "#fff" }}>
            <h3 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 24, fontWeight: 600, margin: "0 0 6px" }}>
              Where should we send your lead plan?
            </h3>
            <p style={{ fontSize: 14, color: "#C9C4BC", margin: "0 0 20px", lineHeight: 1.55, maxWidth: 560 }}>
              John will personally review your numbers, send your plan, and walk you through it on a free call.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 14 }}>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
                style={{ ...inputStyle, background: "#2A2824", border: "1px solid #3A3833", color: "#fff" }} />
              <input value={email} onChange={e => { setEmail(e.target.value); setError("") }} type="email" placeholder="you@agency.com"
                style={{ ...inputStyle, background: "#2A2824", border: `1px solid ${error ? "#C2410C" : "#3A3833"}`, color: "#fff" }} />
              <input value={agency} onChange={e => setAgency(e.target.value)} placeholder="Agency name"
                style={{ ...inputStyle, background: "#2A2824", border: "1px solid #3A3833", color: "#fff" }} />
            </div>
            <input value={honeypot} onChange={e => setHoneypot(e.target.value)} tabIndex={-1} autoComplete="off"
              aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} />
            {error && <div style={{ fontSize: 12, color: "#F0A088", marginBottom: 10 }}>{error}</div>}
            <button onClick={submit} disabled={submitting}
              style={{ fontSize: 14, fontWeight: 600, color: "#fff", background: accent, border: "none", borderRadius: 9, padding: "12px 24px", cursor: submitting ? "default" : "pointer", opacity: submitting ? 0.7 : 1 }}>
              {submitting ? "Sending…" : "Get my lead plan →"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
