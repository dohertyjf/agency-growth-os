"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { fmtCurrency, type IntakeCalc, type IntakeData } from "@/lib/calc"

interface Prospect {
  id: string
  email: string
  name: string | null
  agency: string | null
  data: IntakeData
  answers: Record<string, string>
  calc: IntakeCalc
  converted: boolean
}

interface Props {
  prospects: Prospect[]
}

const QUESTIONS = [
  { key: "q_biggest_challenge", label: "Biggest challenge right now" },
  { key: "q_revenue_goal", label: "Revenue goal (12 months)" },
  { key: "q_bottleneck", label: "Biggest bottleneck" },
  { key: "q_team", label: "Team structure" },
  { key: "q_services", label: "Core services" },
  { key: "q_ideal_client", label: "Ideal client" },
  { key: "q_referral", label: "How did you hear about us?" },
  { key: "q_timeline", label: "Timeline to start" },
  { key: "q_invest", label: "Investment capacity" },
  { key: "q_other", label: "Anything else" },
  { key: "q_commitment", label: "Commitment" },
]

export default function ProspectsClient({ prospects: initial }: Props) {
  const [prospects, setProspects] = useState<Prospect[]>(initial)
  const [selected, setSelected] = useState<Prospect | null>(initial[0] ?? null)
  const [converting, setConverting] = useState(false)
  const router = useRouter()

  async function handleConvert() {
    if (!selected || converting) return
    setConverting(true)
    const res = await fetch(`/api/prospects/${selected.id}/convert`, { method: "POST" })
    const data = await res.json()
    if (res.ok) {
      setProspects(prev => prev.filter(p => p.id !== selected.id))
      setSelected(prospects.find(p => p.id !== selected.id) ?? null)
      if (data.clientId) router.push(`/clients/${data.clientId}`)
    }
    setConverting(false)
  }

  const fmtCalc = (v: number | null, type: "currency" | "number" | "x" | "percent") => {
    if (v === null) return "—"
    if (type === "currency") return fmtCurrency(v)
    if (type === "x") return (Math.round(v * 10) / 10) + "x"
    if (type === "percent") return (Math.round(v * 10) / 10) + "%"
    return String(Math.round(v))
  }

  return (
    <div>
      <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 28, fontWeight: 600, color: "#1A1916", margin: "0 0 24px" }}>
        Prospects
      </h1>

      {prospects.length === 0 ? (
        <div style={{ color: "#9C9590", fontSize: 14 }}>No unconverted prospects yet.</div>
      ) : (
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          {/* List */}
          <div style={{ width: 260, flexShrink: 0, background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, overflow: "hidden" }}>
            {prospects.map(p => (
              <div
                key={p.id}
                onClick={() => setSelected(p)}
                style={{
                  padding: "12px 16px",
                  cursor: "pointer",
                  background: selected?.id === p.id ? "#FFF7F4" : "transparent",
                  borderLeft: `3px solid ${selected?.id === p.id ? "#E9532A" : "transparent"}`,
                  borderBottom: "1px solid #F5F1EC",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1916" }}>{p.name || p.email}</div>
                {p.agency && <div style={{ fontSize: 11, color: "#9C9590" }}>{p.agency}</div>}
                {p.calc.cacLtgp !== null && (
                  <div style={{ fontSize: 10, color: "#6B6760", marginTop: 2 }}>
                    CAC:LTGP {fmtCalc(p.calc.cacLtgp, "x")}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Detail */}
          {selected && (
            <div style={{ flex: 1, background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 22, fontWeight: 600, margin: "0 0 4px" }}>
                    {selected.name || selected.email}
                  </h2>
                  {selected.agency && <div style={{ fontSize: 12, color: "#9C9590" }}>{selected.agency}</div>}
                  <div style={{ fontSize: 12, color: "#9C9590" }}>{selected.email}</div>
                </div>
                <button
                  onClick={handleConvert}
                  disabled={converting}
                  style={{ padding: "8px 18px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: converting ? "default" : "pointer", opacity: converting ? 0.7 : 1 }}
                >
                  {converting ? "Converting…" : "Convert to Client →"}
                </button>
              </div>

              {/* Calculated metrics */}
              <div style={{ background: "#FBFAF7", borderRadius: 8, padding: 16, marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#9C9590", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 12 }}>Key Metrics</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                  {[
                    { label: "CAC", value: fmtCalc(selected.calc.cac, "currency") },
                    { label: "Avg Client Value/Mo", value: fmtCalc(selected.calc.avgClientValuePerMo, "currency") },
                    { label: "Client LTV", value: fmtCalc(selected.calc.clientLTV, "currency") },
                    { label: "Close Rate", value: fmtCalc(selected.calc.closeRate, "percent") },
                    { label: "Avg LTGP", value: fmtCalc(selected.calc.avgLTGP, "currency") },
                    { label: "CAC:LTGP", value: fmtCalc(selected.calc.cacLtgp, "x") },
                    { label: "Effective Hourly Rate", value: fmtCalc(selected.calc.effectiveHourlyRate, "currency") },
                    { label: "People Cost / Client", value: fmtCalc(selected.calc.peopleCostPerClient, "currency") },
                  ].map(item => (
                    <div key={item.label}>
                      <div style={{ fontSize: 10, color: "#9C9590", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>{item.label}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#1A1916", fontVariantNumeric: "tabular-nums" }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Q&A answers */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#9C9590", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 12 }}>Intake Answers</div>
                {QUESTIONS.map(q => {
                  const answer = selected.answers[q.key]
                  if (!answer) return null
                  return (
                    <div key={q.key} style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#6B6760", marginBottom: 3 }}>{q.label}</div>
                      <div style={{ fontSize: 13, color: "#1A1916", lineHeight: 1.5 }}>{answer}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
