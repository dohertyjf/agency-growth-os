"use client"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { leadsGoal } from "@/lib/calc"
import LeadGoalResults from "@/components/LeadGoalResults"

const accent = "#E9532A"

interface Inputs {
  currentRevenue: number
  goalRevenue: number
  closeRate: number
  avgDealValue: number
  recurringRevenue: number
  currentLeads: number | null
}

interface Lead {
  id: string
  email: string
  name: string | null
  agency: string | null
  currency: string
  inputs: Inputs
  adjustedInputs: Inputs | null
  takeaways: string | null
  scheduled: boolean
  createdAt: string
}

const FIELDS: { key: keyof Inputs; label: string; money?: boolean; pct?: boolean; step?: number }[] = [
  { key: "currentRevenue", label: "Current revenue / mo", money: true, step: 500 },
  { key: "goalRevenue", label: "Goal revenue / mo", money: true, step: 1000 },
  { key: "closeRate", label: "Close rate", pct: true, step: 1 },
  { key: "avgDealValue", label: "Avg revenue / new client", money: true, step: 250 },
  { key: "recurringRevenue", label: "Recurring / mo", money: true, step: 500 },
  { key: "currentLeads", label: "Sales conversations / mo", step: 1 },
]

export default function LeadGoalReportClient({ lead, schedulingUrl }: { lead: Lead; schedulingUrl: string }) {
  const router = useRouter()
  const sym = lead.currency === "GBP" ? "£" : lead.currency === "EUR" ? "€" : "$"

  const [inputs, setInputs] = useState<Inputs>(lead.adjustedInputs ?? lead.inputs)
  const [takeaways, setTakeaways] = useState(lead.takeaways ?? "")
  const [scheduled, setScheduled] = useState(lead.scheduled)
  const [months, setMonths] = useState(12)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const r = useMemo(
    () => leadsGoal({ ...inputs, currentLeads: inputs.currentLeads, months }),
    [inputs, months]
  )

  const dirty =
    JSON.stringify(inputs) !== JSON.stringify(lead.adjustedInputs ?? lead.inputs) ||
    takeaways !== (lead.takeaways ?? "")

  function setField(key: keyof Inputs, value: number) {
    setInputs(prev => ({ ...prev, [key]: value }))
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/lead-goal/${lead.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adjustedInputs: inputs, takeaways: takeaways || null }),
      })
      if (res.ok) { setSavedAt("Saved"); router.refresh() }
    } finally { setSaving(false) }
  }

  async function toggleScheduled() {
    const next = !scheduled
    setScheduled(next)
    await fetch(`/api/lead-goal/${lead.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduled: next }),
    })
    router.refresh()
  }

  function resetToSubmitted() { setInputs(lead.inputs) }

  return (
    <div>
      <style>{`
        .print-only { display: none; }
        @media print {
          nav { display: none !important; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body, main { background: #fff !important; }
          main { max-width: none !important; padding: 0 !important; }
          .report-card { border: none !important; box-shadow: none !important; }
          .report-card, .report-card * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        @page { margin: 18mm; }
      `}</style>

      {/* Controls — hidden in print */}
      <div className="no-print" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <a href="/leads/lead-goal" style={{ fontSize: 13, color: "#6B6760", textDecoration: "none" }}>← All submissions</a>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={toggleScheduled}
            style={{ fontSize: 12, fontWeight: 600, borderRadius: 7, padding: "8px 14px", cursor: "pointer", border: "1px solid #ECE7DE", background: scheduled ? "#E8F3EC" : "#fff", color: scheduled ? "#1F7A4D" : "#6B6760" }}>
            {scheduled ? "✓ Call booked" : "Mark call booked"}
          </button>
          <button onClick={resetToSubmitted}
            style={{ fontSize: 12, fontWeight: 600, color: "#9C9590", background: "#fff", border: "1px solid #ECE7DE", borderRadius: 7, padding: "8px 14px", cursor: "pointer" }}>
            Reset to submitted
          </button>
          <button onClick={save} disabled={saving || !dirty}
            style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: dirty ? "#1A1916" : "#C9C4BC", border: "none", borderRadius: 7, padding: "8px 16px", cursor: dirty && !saving ? "pointer" : "default" }}>
            {saving ? "Saving…" : dirty ? "Save changes" : savedAt ?? "Saved"}
          </button>
          <button onClick={() => window.print()}
            style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: accent, border: "none", borderRadius: 7, padding: "8px 16px", cursor: "pointer" }}>
            Save as PDF
          </button>
        </div>
      </div>

      {/* Report */}
      <div className="report-card" style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 28 }}>
        {/* Header */}
        <div style={{ marginBottom: 24, borderBottom: "1px solid #F1ECE3", paddingBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 26, height: 26, borderRadius: 6, background: accent, color: "#fff", fontFamily: "var(--font-cormorant), serif", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>JD</div>
            <span style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 16, fontWeight: 600 }}>Agency Growth OS</span>
          </div>
          <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 26, fontWeight: 600, margin: "0 0 4px", color: "#1A1916" }}>
            Lead Plan — {lead.agency || lead.name || "Agency"}
          </h1>
          <div style={{ fontSize: 13, color: "#9C9590" }}>
            {lead.name ? `${lead.name} · ` : ""}{lead.email} · submitted {new Date(lead.createdAt).toLocaleDateString()}
          </div>
        </div>

        {/* CTA — near the top; hidden once the call is booked */}
        {!scheduled && (
          <div style={{ textAlign: "center", background: "#FBF0EB", border: "1px solid #F0C3B0", borderRadius: 10, padding: "18px 20px", marginBottom: 20 }}>
            <div style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 20, fontWeight: 600, color: "#1A1916", marginBottom: 4 }}>
              Ready to hit your goal?
            </div>
            <div style={{ fontSize: 13, color: "#6F6B64", margin: "0 auto 14px", maxWidth: 480, lineHeight: 1.5 }}>
              Book a Growth Projection Review Call and we&apos;ll walk through your numbers and the fastest path to your target.
            </div>
            <a href={schedulingUrl} target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-block", background: accent, color: "#fff", fontSize: 15, fontWeight: 700, textDecoration: "none", borderRadius: 10, padding: "12px 26px" }}>
              Schedule your Growth Projection Review Call →
            </a>
            <div style={{ fontSize: 12, color: "#9C9590", marginTop: 10 }}>{schedulingUrl}</div>
          </div>
        )}

        {/* Results */}
        <LeadGoalResults
          r={r}
          goalRevenue={inputs.goalRevenue}
          currentLeads={inputs.currentLeads}
          months={months}
          setMonths={setMonths}
          currency={lead.currency}
        />

        {/* Inputs (editable) */}
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9C9590", margin: "26px 0 10px" }}>Inputs</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 4 }}>
          {FIELDS.map(f => {
            const raw = (inputs[f.key] as number) ?? 0
            const display = f.pct ? Math.round(raw * 100) : raw
            return (
              <div key={f.key}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#6B6760", display: "block", marginBottom: 4 }}>
                  {f.label}{f.money ? ` ${sym}` : ""}{f.pct ? " %" : ""}
                </label>
                <input type="number" step={f.step} value={display}
                  onChange={e => { const v = parseFloat(e.target.value) || 0; setField(f.key, f.pct ? v / 100 : v) }}
                  style={{ padding: "7px 10px", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 13, background: "#FCFBF8", color: "#1A1916", width: "100%", boxSizing: "border-box", fontFamily: "inherit", outline: "none", fontVariantNumeric: "tabular-nums" }} />
              </div>
            )
          })}
        </div>

        {/* Notes */}
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9C9590", margin: "26px 0 10px" }}>Notes</div>
        <textarea className="no-print" value={takeaways} onChange={e => setTakeaways(e.target.value)} rows={6}
          placeholder="Add your notes and recommendations here — these appear on the PDF you send to the prospect."
          style={{ width: "100%", boxSizing: "border-box", fontSize: 14, lineHeight: 1.6, color: "#1A1916", border: "1px solid #ECE7DE", borderRadius: 8, padding: "12px 14px", background: "#FCFBF8", resize: "vertical", fontFamily: "inherit" }} />
        <div className="print-only" style={{ fontSize: 14, lineHeight: 1.6, color: "#1A1916", whiteSpace: "pre-wrap" }}>{takeaways}</div>
      </div>
    </div>
  )
}
