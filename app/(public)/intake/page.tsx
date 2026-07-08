"use client"

import { useState, useRef } from "react"
import { calcIntake } from "@/lib/calc"

const INTAKE_ROWS = [
  { key: "leads", label: "Leads", fmt: "int" },
  { key: "qualifiedLeads", label: "Qualified leads", fmt: "int" },
  { key: "newClients", label: "New clients won", fmt: "int" },
  { key: "newRevenue", label: "New revenue", fmt: "money" },
  { key: "totalClients", label: "Total clients", fmt: "int" },
  { key: "overallRevenue", label: "Overall revenue", fmt: "money" },
  { key: "churnedClients", label: "Churned clients", fmt: "int" },
  { key: "churnedRevenue", label: "Churned revenue", fmt: "money" },
  { key: "marketingSpend", label: "Marketing spend", fmt: "money" },
  { key: "avgMonthsStay", label: "Avg months a client stays", fmt: "num" },
  { key: "peopleCost", label: "Total people cost / month", fmt: "money" },
  { key: "hoursForClients", label: "Hours worked for clients / month", fmt: "num" },
]

const QUESTIONS = [
  { key: "idealCustomer", label: "Who is your ideal customer?" },
  { key: "offer", label: "What's your offer to clients?" },
  { key: "upfront", label: "Do you sell anything up front (audit / roadmap / strategy)? If so, what and how priced?" },
  { key: "pricing", label: "How much do you charge for your services?" },
  { key: "contracts", label: "Do you have contracts in place for all clients?" },
  { key: "billing", label: "What are your billing terms?" },
  { key: "objection", label: "What objection do you most commonly get when doing sales?" },
  { key: "leadSource", label: "How do you get most of your leads?" },
  { key: "team", label: "What does your team / support look like?" },
  { key: "improve", label: "Where do you specifically want to improve?" },
  { key: "holdingBack", label: "What do you think is holding you back?" },
]

type Grid = Record<string, [string, string, string]>

function fmtNull(v: number | null, prefix = "$") {
  if (v == null) return "—"
  return prefix + Math.round(v).toLocaleString()
}

function matchKey(line: string): string | null {
  const lower = line.toLowerCase()
  if (lower.includes("qualified") || lower.includes("ql")) return "qualifiedLeads"
  if (lower.includes("lead")) return "leads"
  if (lower.includes("new client")) return "newClients"
  if (lower.includes("new rev")) return "newRevenue"
  if (lower.includes("total client")) return "totalClients"
  if (lower.includes("overall rev") || lower.includes("mrr") || lower.includes("overall revenue")) return "overallRevenue"
  if (lower.includes("churned client")) return "churnedClients"
  if (lower.includes("churned rev")) return "churnedRevenue"
  if (lower.includes("market")) return "marketingSpend"
  if (lower.includes("avg month") || lower.includes("months stay") || lower.includes("lifespan")) return "avgMonthsStay"
  if (lower.includes("people cost") || lower.includes("salary") || lower.includes("salaries")) return "peopleCost"
  if (lower.includes("hour")) return "hoursForClients"
  return null
}

export default function IntakePage() {
  const [step, setStep] = useState(0)
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [agency, setAgency] = useState("")
  const [grid, setGrid] = useState<Grid>(() =>
    Object.fromEntries(INTAKE_ROWS.map(r => [r.key, ["", "", ""]]))
  )
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [pasteText, setPasteText] = useState("")
  const [showPaste, setShowPaste] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [emailError, setEmailError] = useState("")

  const lastMonthNums = Object.fromEntries(
    INTAKE_ROWS.map(r => [r.key, parseFloat(grid[r.key][0]) || 0])
  )
  const calc = calcIntake(lastMonthNums)

  function applyPaste() {
    const lines = pasteText.split("\n")
    const newGrid = { ...grid }
    for (const line of lines) {
      const key = matchKey(line)
      if (!key) continue
      const nums = Array.from(line.matchAll(/[\d,]+(?:\.\d+)?/g))
        .map(m => m[0].replace(/,/g, ""))
        .filter(s => !isNaN(parseFloat(s)))
      if (nums.length >= 3) {
        const last3 = nums.slice(-3) as [string, string, string]
        newGrid[key] = last3
      } else if (nums.length > 0) {
        const padded = [...nums] as string[]
        while (padded.length < 3) padded.unshift("0")
        newGrid[key] = padded.slice(-3) as [string, string, string]
      }
    }
    setGrid(newGrid)
    setShowPaste(false)
    setPasteText("")
  }

  async function submit() {
    setSubmitting(true)
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: name || undefined,
          agency: agency || undefined,
          data: Object.fromEntries(
            Object.entries(grid).map(([k, arr]) => [k, arr])
          ),
          answers,
          honeypot: "",
        }),
      })
      if (res.ok) setSubmitted(true)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div style={{ minHeight: "100vh", background: "#FBFAF7", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", maxWidth: 480, padding: "0 24px" }}>
          <div style={{ width: 56, height: 56, margin: "0 auto 20px", borderRadius: 14, background: "#E9532A", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <h1 style={{ fontFamily: "var(--font-cormorant)", fontSize: 32, fontWeight: 600, margin: "0 0 12px" }}>You're all set</h1>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: "#6F6B64" }}>John will reach out at <strong>{email}</strong> to schedule your first call. Keep an eye on your inbox.</p>
        </div>
      </div>
    )
  }

  const steps = ["Details", "Your numbers", "A few questions", "Review & send"]
  const accent = "#E9532A"

  return (
    <div style={{ minHeight: "100vh", background: "#FBFAF7" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid #ECE7DE", padding: "14px 32px", display: "flex", alignItems: "center", gap: 10, background: "rgba(251,250,247,0.92)", backdropFilter: "blur(8px)" }}>
        <div style={{ width: 31, height: 31, borderRadius: 7, background: "#E9532A", color: "#fff", fontFamily: "var(--font-cormorant)", fontWeight: 700, fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center" }}>JD</div>
        <span style={{ fontFamily: "var(--font-cormorant)", fontSize: 20, fontWeight: 600 }}>Agency Growth OS</span>
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "40px 24px 80px" }}>
        {/* Progress */}
        <div style={{ display: "flex", gap: 6, marginBottom: 36 }}>
          {steps.map((s, i) => (
            <div key={s} style={{ flex: 1 }}>
              <div style={{ height: 3, borderRadius: 2, background: i <= step ? accent : "#E5E0D8" }} />
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: i === step ? "#1A1916" : "#9a958c", marginTop: 6 }}>{s}</div>
            </div>
          ))}
        </div>

        {step === 0 && (
          <div>
            <h1 style={{ fontFamily: "var(--font-cormorant)", fontSize: 30, fontWeight: 600, margin: "0 0 6px" }}>Let's get to know your agency</h1>
            <p style={{ color: "#6F6B64", fontSize: 14, margin: "0 0 32px" }}>This takes about 5 minutes. John reviews every submission personally.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a857c", marginBottom: 6 }}>Email *</label>
                <input value={email} onChange={e => { setEmail(e.target.value); setEmailError("") }} type="email" placeholder="you@agency.com" style={{ width: "100%", fontSize: 15, color: "#1A1916", border: "1px solid #ECE7DE", borderRadius: 9, padding: "11px 13px", background: "#FCFBF8" }} />
                {emailError && <div style={{ fontSize: 12, color: "#C2410C", marginTop: 4 }}>{emailError}</div>}
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a857c", marginBottom: 6 }}>Your name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Maria Chen" style={{ width: "100%", fontSize: 15, color: "#1A1916", border: "1px solid #ECE7DE", borderRadius: 9, padding: "11px 13px", background: "#FCFBF8" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a857c", marginBottom: 6 }}>Agency name</label>
                <input value={agency} onChange={e => setAgency(e.target.value)} placeholder="Apex Studio" style={{ width: "100%", fontSize: 15, color: "#1A1916", border: "1px solid #ECE7DE", borderRadius: 9, padding: "11px 13px", background: "#FCFBF8" }} />
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <h1 style={{ fontFamily: "var(--font-cormorant)", fontSize: 30, fontWeight: 600, margin: "0 0 6px" }}>Your numbers</h1>
            <p style={{ color: "#6F6B64", fontSize: 14, margin: "0 0 20px" }}>Fill in the last 3 months. Columns go oldest (left) → most recent (right).</p>

            {/* Paste accelerator */}
            <div style={{ marginBottom: 20 }}>
              <button onClick={() => setShowPaste(!showPaste)} style={{ fontSize: 12, fontWeight: 600, color: accent, background: "rgba(233,83,42,0.08)", border: "none", borderRadius: 7, padding: "7px 13px", cursor: "pointer" }}>
                {showPaste ? "Hide" : "Paste from spreadsheet ↓"}
              </button>
              {showPaste && (
                <div style={{ marginTop: 10, background: "#fff", border: "1px solid #ECE7DE", borderRadius: 10, padding: 14 }}>
                  <textarea
                    value={pasteText}
                    onChange={e => setPasteText(e.target.value)}
                    rows={6}
                    placeholder="Paste rows from your spreadsheet here…"
                    style={{ width: "100%", fontSize: 13, border: "1px solid #ECE7DE", borderRadius: 7, padding: "10px 12px", background: "#FCFBF8", resize: "vertical" }}
                  />
                  <button onClick={applyPaste} style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: "#fff", background: "#1A1916", border: "none", borderRadius: 7, padding: "8px 16px", cursor: "pointer" }}>Fill the grid</button>
                </div>
              )}
            </div>

            {/* Grid */}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "8px 12px", fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#8a857c", borderBottom: "1px solid #ECE7DE" }}></th>
                    {["3 mo ago", "2 mo ago", "Last month"].map(h => (
                      <th key={h} style={{ textAlign: "right", padding: "8px 12px", fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#8a857c", borderBottom: "1px solid #ECE7DE" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {INTAKE_ROWS.map(row => (
                    <tr key={row.key}>
                      <td style={{ padding: "8px 12px", fontSize: 13, color: "#3a372f", borderBottom: "1px solid #F1ECE3" }}>{row.label}</td>
                      {[2, 1, 0].map(colIdx => (
                        <td key={colIdx} style={{ padding: "4px 6px", borderBottom: "1px solid #F1ECE3" }}>
                          <input
                            value={grid[row.key][colIdx]}
                            onChange={e => {
                              const updated = [...grid[row.key]] as [string, string, string]
                              updated[colIdx] = e.target.value
                              setGrid({ ...grid, [row.key]: updated })
                            }}
                            style={{ display: "block", width: "100%", textAlign: "right", fontSize: 13, color: "#1A1916", border: "1px solid #ECE7DE", borderRadius: 6, padding: "7px 9px", background: colIdx === 0 ? "#FFFAF8" : "#FCFBF8", fontVariantNumeric: "tabular-nums" }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Live metrics */}
            <div style={{ marginTop: 20, background: "#FBF7F0", border: "1px solid #ECE3D4", borderRadius: 12, padding: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#c06a3f", marginBottom: 14 }}>Calculated from last month</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
                {[
                  { label: "CAC : LTGP", value: calc.cacLtgp == null ? "—" : `${calc.cacLtgp.toFixed(1)} : 1`, big: true },
                  { label: "Avg client value / mo", value: fmtNull(calc.avgClientValuePerMo) },
                  { label: "Avg client LTV", value: fmtNull(calc.clientLTV) },
                  { label: "Close rate", value: calc.closeRate == null ? "—" : `${(Math.round(calc.closeRate * 10) / 10)}%` },
                  { label: "CAC", value: fmtNull(calc.cac) },
                  { label: "Avg LTGP", value: fmtNull(calc.avgLTGP) },
                  { label: "Effective hourly rate", value: fmtNull(calc.effectiveHourlyRate) },
                ].map(c => (
                  <div key={c.label} style={{ background: "#fff", border: `1px solid ${c.big ? "#F0C3B0" : "#ECE7DE"}`, borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#8a857c" }}>{c.label}</div>
                    <div style={{ fontSize: c.big ? 22 : 16, fontWeight: 700, color: c.big ? accent : "#1A1916", marginTop: 6, fontVariantNumeric: "tabular-nums" }}>{c.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 style={{ fontFamily: "var(--font-cormorant)", fontSize: 30, fontWeight: 600, margin: "0 0 6px" }}>A few questions</h1>
            <p style={{ color: "#6F6B64", fontSize: 14, margin: "0 0 28px" }}>These help John prepare for your first call.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {QUESTIONS.map(q => (
                <div key={q.key}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#1A1916", marginBottom: 6 }}>{q.label}</label>
                  <textarea
                    value={answers[q.key] ?? ""}
                    onChange={e => setAnswers({ ...answers, [q.key]: e.target.value })}
                    rows={2}
                    style={{ width: "100%", fontSize: 14, color: "#1A1916", border: "1px solid #ECE7DE", borderRadius: 8, padding: "10px 12px", background: "#FCFBF8", resize: "vertical", lineHeight: 1.55 }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h1 style={{ fontFamily: "var(--font-cormorant)", fontSize: 30, fontWeight: 600, margin: "0 0 6px" }}>Review & send</h1>
            <p style={{ color: "#6F6B64", fontSize: 14, margin: "0 0 24px" }}>Look good? Hit send and John will reach out to schedule your call.</p>
            <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a857c", marginBottom: 12 }}>Contact</div>
              <div style={{ fontSize: 14, color: "#1A1916" }}><strong>{name || "—"}</strong> · {email}</div>
              {agency && <div style={{ fontSize: 13, color: "#6F6B64", marginTop: 2 }}>{agency}</div>}
            </div>
            <div style={{ background: "#FBF7F0", border: "1px solid #ECE3D4", borderRadius: 12, padding: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#c06a3f", marginBottom: 10 }}>Key metrics · last month</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><span style={{ fontSize: 12, color: "#8a857c" }}>CAC:LTGP </span><strong style={{ color: accent }}>{calc.cacLtgp == null ? "—" : `${calc.cacLtgp.toFixed(1)} : 1`}</strong></div>
                <div><span style={{ fontSize: 12, color: "#8a857c" }}>Close rate </span><strong>{calc.closeRate == null ? "—" : `${(Math.round(calc.closeRate * 10) / 10)}%`}</strong></div>
                <div><span style={{ fontSize: 12, color: "#8a857c" }}>Avg LTV </span><strong>{fmtNull(calc.clientLTV)}</strong></div>
                <div><span style={{ fontSize: 12, color: "#8a857c" }}>EHR </span><strong>{fmtNull(calc.effectiveHourlyRate)}</strong></div>
              </div>
            </div>
          </div>
        )}

        {/* Nav */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 36 }}>
          {step > 0 ? (
            <button onClick={() => setStep(s => s - 1)} style={{ fontSize: 13, fontWeight: 600, color: "#6F6B64", background: "#fff", border: "1px solid #E0DAD0", borderRadius: 9, padding: "11px 20px", cursor: "pointer" }}>← Back</button>
          ) : <div />}
          {step < 3 ? (
            <button
              onClick={() => {
                if (step === 0) {
                  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    setEmailError("Please enter a valid email address")
                    return
                  }
                }
                setStep(s => s + 1)
              }}
              style={{ fontSize: 13, fontWeight: 600, color: "#fff", background: accent, border: "none", borderRadius: 9, padding: "11px 22px", cursor: "pointer" }}
            >
              Continue →
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={submitting}
              style={{ fontSize: 13, fontWeight: 600, color: "#fff", background: accent, border: "none", borderRadius: 9, padding: "11px 22px", cursor: submitting ? "default" : "pointer", opacity: submitting ? 0.7 : 1 }}
            >
              {submitting ? "Sending…" : "Send to John →"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
