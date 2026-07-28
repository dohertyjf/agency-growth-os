"use client"
import { useEffect, useRef, useState } from "react"

type Currency = "USD" | "GBP" | "EUR"
function currSym(c: Currency) { return c === "GBP" ? "£" : c === "EUR" ? "€" : "$" }

const accent = "#E9532A"
const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: "#6B6760", display: "block", marginBottom: 4,
}
const inputStyle: React.CSSProperties = {
  padding: "8px 11px", border: "1px solid #ECE7DE", borderRadius: 8,
  fontSize: 14, background: "#FCFBF8", color: "#1A1916",
  width: "100%", boxSizing: "border-box", fontFamily: "inherit", outline: "none",
}

interface Props {
  embed?: boolean
  schedulingUrl?: string
}

export default function CapacityCalculator({ embed = false, schedulingUrl = "" }: Props) {
  const [currency, setCurrency] = useState<Currency>("USD")
  const sym = currSym(currency)

  // Inputs — sensible agency defaults so the fields aren't empty on load.
  const [startRevenue, setStartRevenue] = useState(20000)
  const [leads, setLeads] = useState(10)
  const [closeRate, setCloseRate] = useState(20)
  const [avgDeal, setAvgDeal] = useState(3000)
  const [churn, setChurn] = useState(1)
  const [hoursPerClient, setHoursPerClient] = useState(20)
  const [billableHours, setBillableHours] = useState(320)
  const [activeClients, setActiveClients] = useState(7)
  const [goalMRR, setGoalMRR] = useState(50000)

  // Lead capture
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [agency, setAgency] = useState("")
  const [honeypot, setHoneypot] = useState("")
  const [emailError, setEmailError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [showCapture, setShowCapture] = useState(false)

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

  async function submit() {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Please enter a valid email address")
      return
    }
    setEmailError("")
    setSubmitting(true)
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email, name: name || undefined, agency: agency || undefined, currency,
          inputs: { startRevenue, leads, closeRate, avgDeal, churn, hoursPerClient, billableHours, activeClients, goalMRR },
          honeypot,
        }),
      })
      if (res.ok) {
        if (schedulingUrl) {
          if (embed && window.parent !== window) {
            window.parent.postMessage({ type: "jd-calc:redirect", url: schedulingUrl }, "*")
          } else {
            window.location.href = schedulingUrl
          }
        } else {
          setSubmitted(true)
        }
      }
    } finally {
      setSubmitting(false)
    }
  }

  const num = (setter: (n: number) => void) =>
    (e: React.ChangeEvent<HTMLInputElement>) => setter(parseFloat(e.target.value) || 0)

  if (submitted) {
    return (
      <div ref={rootRef} style={{ background: "#FBFAF7", padding: embed ? "48px 24px" : "80px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div style={{ width: 56, height: 56, margin: "0 auto 20px", borderRadius: 14, background: accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <h2 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 30, fontWeight: 600, margin: "0 0 12px", color: "#1A1916" }}>Thanks — you&apos;re in.</h2>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: "#6F6B64" }}>
            John will personally review your numbers and send a breakdown to <strong>{email}</strong>.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div ref={rootRef} style={{ background: "#FBFAF7", padding: embed ? "24px 18px" : "40px 24px" }}>
      <div style={{ maxWidth: 940, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
            <div>
              <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 32, fontWeight: 600, margin: "0 0 8px", color: "#1A1916", lineHeight: 1.15 }}>
                When does your agency&apos;s growth model cap out?
              </h1>
              <p style={{ fontSize: 15, color: "#6F6B64", margin: 0, maxWidth: 620, lineHeight: 1.55 }}>
                Enter your numbers and John will send you a personalized report — the month your
                current model caps out, and the specific moves to grow past it.
              </p>
            </div>
            <select
              value={currency}
              onChange={e => setCurrency(e.target.value as Currency)}
              style={{ ...inputStyle, width: "auto", padding: "8px 12px", cursor: "pointer" }}
              aria-label="Currency"
            >
              <option value="USD">$ USD</option>
              <option value="GBP">£ GBP</option>
              <option value="EUR">€ EUR</option>
            </select>
          </div>
        </div>

        {/* Inputs */}
        <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14 }}>
            <div>
              <label style={labelStyle}>Current Revenue / mo {sym}</label>
              <input style={inputStyle} type="number" min={0} step={500} value={startRevenue} onChange={num(setStartRevenue)} />
            </div>
            <div>
              <label style={labelStyle}>Leads / mo</label>
              <input style={inputStyle} type="number" min={0} step={0.5} value={leads} onChange={num(setLeads)} />
            </div>
            <div>
              <label style={labelStyle}>Close Rate %</label>
              <input style={inputStyle} type="number" min={0} max={100} step={0.1} value={closeRate} onChange={num(setCloseRate)} />
            </div>
            <div>
              <label style={labelStyle}>Avg Deal Size / mo {sym}</label>
              <input style={inputStyle} type="number" min={0} step={100} value={avgDeal} onChange={num(setAvgDeal)} />
            </div>
            <div>
              <label style={labelStyle}>Churn / mo (clients)</label>
              <input style={inputStyle} type="number" min={0} step={0.5} value={churn} onChange={num(setChurn)} />
            </div>
            <div>
              <label style={labelStyle}>Avg monthly hours per client</label>
              <input style={inputStyle} type="number" min={0} step={0.5} value={hoursPerClient} onChange={num(setHoursPerClient)} />
            </div>
            <div>
              <label style={labelStyle}>Billable Hrs / mo (team)</label>
              <input style={inputStyle} type="number" min={0} step={10} value={billableHours} onChange={num(setBillableHours)} />
            </div>
            <div>
              <label style={labelStyle}>Active Clients</label>
              <input style={inputStyle} type="number" min={0} step={1} value={activeClients} onChange={num(setActiveClients)} />
            </div>
            <div>
              <label style={labelStyle}>MRR Goal {sym}</label>
              <input style={inputStyle} type="number" min={0} step={1000} value={goalMRR} onChange={num(setGoalMRR)} />
            </div>
          </div>
        </div>

        {/* Gate: results are hidden until they submit */}
        {!showCapture ? (
          <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
            <button onClick={() => setShowCapture(true)}
              style={{ fontSize: 16, fontWeight: 600, color: "#fff", background: accent, border: "none", borderRadius: 10, padding: "15px 34px", cursor: "pointer" }}>
              Get your results →
            </button>
            <p style={{ fontSize: 13, color: "#9C9590", margin: "12px auto 0", maxWidth: 460, lineHeight: 1.5 }}>
              John will personally review your numbers and send your full breakdown — where your
              model caps out, and exactly how to break through it.
            </p>
          </div>
        ) : (
          <form onSubmit={e => { e.preventDefault(); submit() }}
            style={{ background: "#1A1916", borderRadius: 14, padding: "26px 24px", color: "#fff" }}>
            <h3 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 24, fontWeight: 600, margin: "0 0 6px" }}>
              Where should we send your results?
            </h3>
            <p style={{ fontSize: 14, color: "#C9C4BC", margin: "0 0 20px", lineHeight: 1.55, maxWidth: 560 }}>
              John will personally review your numbers, send your breakdown, and walk you through
              how to raise your ceiling on a free call.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 14 }}>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
                name="name" autoComplete="name"
                style={{ ...inputStyle, background: "#2A2824", border: "1px solid #3A3833", color: "#fff" }} />
              <input value={email} onChange={e => { setEmail(e.target.value); setEmailError("") }} type="email" placeholder="you@agency.com"
                name="email" autoComplete="email"
                style={{ ...inputStyle, background: "#2A2824", border: `1px solid ${emailError ? "#C2410C" : "#3A3833"}`, color: "#fff" }} />
              <input value={agency} onChange={e => setAgency(e.target.value)} placeholder="Agency name"
                name="organization" autoComplete="organization"
                style={{ ...inputStyle, background: "#2A2824", border: "1px solid #3A3833", color: "#fff" }} />
            </div>
            {/* Honeypot — hidden from humans */}
            <input value={honeypot} onChange={e => setHoneypot(e.target.value)} tabIndex={-1} autoComplete="off"
              aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} />
            {emailError && <div style={{ fontSize: 12, color: "#F0A088", marginBottom: 10 }}>{emailError}</div>}
            <button type="submit" disabled={submitting}
              style={{ fontSize: 14, fontWeight: 600, color: "#fff", background: accent, border: "none", borderRadius: 9, padding: "12px 24px", cursor: submitting ? "default" : "pointer", opacity: submitting ? 0.7 : 1 }}>
              {submitting ? "Sending…" : "Get my results →"}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
