"use client"
import { useEffect, useMemo, useRef, useState } from "react"
import { projectCapacity, fmtCurrency, ymAdd, ymLabel } from "@/lib/calc"
import CapacityChart from "@/components/CapacityChart"

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
  const fmt$ = (v: number) => fmtCurrency(v, currency)

  // Inputs — sensible agency defaults so the chart shows a story immediately.
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

  const r = useMemo(() => projectCapacity({
    startRevenue, leads, closeRate, avgDeal, churn,
    hoursPerClient, billableHours, activeClients, goalMRR,
  }), [startRevenue, leads, closeRate, avgDeal, churn, hoursPerClient, billableHours, activeClients, goalMRR])

  const now = useMemo(() => new Date().toISOString().slice(0, 7), [])
  const monthLabels = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ymLabel(ymAdd(now, i + 1))),
    [now]
  )

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

  const goal = goalMRR
  const capVal = r.mrrCap
  const capMonthLabel = r.capacityHitMonth >= 0 ? monthLabels[r.capacityHitMonth] : null
  const goalReachable = r.goalHitMonth >= 0
  const goalBlockedByCap = goal > 0 && capVal != null && goal > capVal

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
                Enter your numbers below. This models your revenue forward and shows the month your
                delivery capacity becomes the ceiling — the point where more sales can&apos;t grow you.
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

        {/* Verdict */}
        <div style={{ background: capMonthLabel ? "#FBF0EB" : "#F4F7F2", border: `1px solid ${capMonthLabel ? "#F0C3B0" : "#D6E3CE"}`, borderRadius: 12, padding: "18px 20px", marginBottom: 20 }}>
          {capMonthLabel ? (
            <div style={{ fontSize: 16, color: "#1A1916", lineHeight: 1.5 }}>
              At this pace you hit your delivery ceiling of{" "}
              <strong style={{ color: accent }}>{fmt$(capVal!)}/mo</strong>{" "}
              around <strong>{capMonthLabel}</strong>
              {r.maxClients != null && <> — about <strong>{r.maxClients} clients</strong>, all the billable hours your team has</>}.
              {goalBlockedByCap && (
                <div style={{ marginTop: 8, fontSize: 14, color: "#9A3412" }}>
                  ⚠ Your goal of {fmt$(goal)}/mo sits <strong>above</strong>{" "}that ceiling — you can&apos;t sell your way there without adding capacity or raising prices.
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 16, color: "#1A1916", lineHeight: 1.5 }}>
              You&apos;re not capacity-constrained in the next 12 months at this pace.
              {goalReachable
                ? <> You reach your {fmt$(goal)}/mo goal around <strong>{monthLabels[r.goalHitMonth]}</strong>.</>
                : <> Add billable hours or a capacity figure above to find your ceiling.</>}
            </div>
          )}
          <div style={{ fontSize: 13, color: "#6F6B64", marginTop: 10 }}>
            Net movement:{" "}
            <span style={{ color: r.netMRRChange >= 0 ? "#1F7A4D" : "#C2410C", fontWeight: 700 }}>
              {r.netMRRChange >= 0 ? "+" : ""}{fmt$(r.netMRRChange)}/mo
            </span>
            {r.slotsAvailable != null && (
              <> · {r.slotsAvailable > 0 ? `${r.slotsAvailable} client slot${r.slotsAvailable === 1 ? "" : "s"} open now` : "at capacity now"}</>
            )}
          </div>
        </div>

        {/* Chart */}
        <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <CapacityChart
            projected={r.projected}
            startValue={startRevenue}
            mrrCap={r.mrrCap}
            goal={goal}
            capacityHitMonth={r.capacityHitMonth}
            monthLabels={monthLabels}
            currency={currency}
          />
        </div>

        {/* Lead capture */}
        <div style={{ background: "#1A1916", borderRadius: 14, padding: "26px 24px", color: "#fff" }}>
          <h3 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 24, fontWeight: 600, margin: "0 0 6px" }}>
            Want to break through your ceiling?
          </h3>
          <p style={{ fontSize: 14, color: "#C9C4BC", margin: "0 0 20px", lineHeight: 1.55, maxWidth: 560 }}>
            Enter your details and John will personally review your numbers, send you a breakdown,
            and walk you through how to raise your ceiling on a free call.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 14 }}>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
              style={{ ...inputStyle, background: "#2A2824", border: "1px solid #3A3833", color: "#fff" }} />
            <input value={email} onChange={e => { setEmail(e.target.value); setEmailError("") }} type="email" placeholder="you@agency.com"
              style={{ ...inputStyle, background: "#2A2824", border: `1px solid ${emailError ? "#C2410C" : "#3A3833"}`, color: "#fff" }} />
            <input value={agency} onChange={e => setAgency(e.target.value)} placeholder="Agency name"
              style={{ ...inputStyle, background: "#2A2824", border: "1px solid #3A3833", color: "#fff" }} />
          </div>
          {/* Honeypot — hidden from humans */}
          <input value={honeypot} onChange={e => setHoneypot(e.target.value)} tabIndex={-1} autoComplete="off"
            aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} />
          {emailError && <div style={{ fontSize: 12, color: "#F0A088", marginBottom: 10 }}>{emailError}</div>}
          <button onClick={submit} disabled={submitting}
            style={{ fontSize: 14, fontWeight: 600, color: "#fff", background: accent, border: "none", borderRadius: 9, padding: "12px 24px", cursor: submitting ? "default" : "pointer", opacity: submitting ? 0.7 : 1 }}>
            {submitting ? "Sending…" : "Get my breakdown →"}
          </button>
        </div>
      </div>
    </div>
  )
}
