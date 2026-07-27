"use client"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { projectCapacity, fmtCurrency, ymAdd, ymLabel, type CapacityInputs } from "@/lib/calc"
import CapacityChart from "@/components/CapacityChart"

const accent = "#E9532A"

interface Lead {
  id: string
  email: string
  name: string | null
  agency: string | null
  currency: string
  inputs: CapacityInputs
  adjustedInputs: CapacityInputs | null
  takeaways: string | null
  scheduled: boolean
  createdAt: string
}

const FIELDS: { key: keyof CapacityInputs; label: string; money?: boolean; step?: number }[] = [
  { key: "startRevenue", label: "Current Revenue / mo", money: true, step: 500 },
  { key: "leads", label: "Leads / mo", step: 0.5 },
  { key: "closeRate", label: "Close Rate %", step: 0.1 },
  { key: "avgDeal", label: "Avg Deal Size / mo", money: true, step: 100 },
  { key: "churn", label: "Churn / mo", step: 0.5 },
  { key: "hoursPerClient", label: "Avg monthly hours per client", step: 0.5 },
  { key: "billableHours", label: "Billable Hrs / mo", step: 10 },
  { key: "activeClients", label: "Active Clients", step: 1 },
  { key: "goalMRR", label: "MRR Goal", money: true, step: 1000 },
]

export default function LeadDetailClient({ lead, schedulingUrl }: { lead: Lead; schedulingUrl: string }) {
  const router = useRouter()
  const sym = lead.currency === "GBP" ? "£" : lead.currency === "EUR" ? "€" : "$"
  const fmt$ = (v: number) => fmtCurrency(v, lead.currency)

  const [inputs, setInputs] = useState<CapacityInputs>(lead.adjustedInputs ?? lead.inputs)
  const [takeaways, setTakeaways] = useState(lead.takeaways ?? "")
  const [scheduled, setScheduled] = useState(lead.scheduled)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const r = useMemo(() => projectCapacity(inputs), [inputs])
  const now = useMemo(() => new Date().toISOString().slice(0, 7), [])
  const monthLabels = useMemo(() => Array.from({ length: 12 }, (_, i) => ymLabel(ymAdd(now, i + 1))), [now])
  const capMonthLabel = r.capacityHitMonth >= 0 ? monthLabels[r.capacityHitMonth] : null
  const goal = inputs.goalMRR ?? 0
  const goalBlockedByCap = goal > 0 && r.mrrCap != null && goal > r.mrrCap

  // The 4 most common growth levers — each re-runs the model with one input changed.
  const scenarios = useMemo(() => {
    const outcome = (patch: Partial<CapacityInputs>) => {
      const res = projectCapacity({ ...inputs, ...patch })
      if (res.mrrCap == null) return "no capacity ceiling at these settings"
      return res.capacityHitMonth >= 0
        ? `tops out at ${fmtCurrency(res.mrrCap, lead.currency)} in ${monthLabels[res.capacityHitMonth]}`
        : `lifts your ceiling to ${fmtCurrency(res.mrrCap, lead.currency)} — beyond the next 12 months at this pace`
    }
    const cut = Math.max(1, Math.round(inputs.hoursPerClient * 0.75))
    return [
      { label: `Raise average client value 50% (to ${fmtCurrency(Math.round(inputs.avgDeal * 1.5), lead.currency)}/mo)`, result: outcome({ avgDeal: inputs.avgDeal * 1.5 }) },
      { label: `Cut hours per client to ${cut} (−25% delivery time)`, result: outcome({ hoursPerClient: cut }) },
      { label: `Double delivery capacity (to ${inputs.billableHours * 2} billable hrs/mo)`, result: outcome({ billableHours: inputs.billableHours * 2 }) },
      { label: `Double your leads (to ${inputs.leads * 2}/mo)`, result: outcome({ leads: inputs.leads * 2 }) },
    ]
  }, [inputs, monthLabels, lead.currency])

  const dirty =
    JSON.stringify(inputs) !== JSON.stringify(lead.adjustedInputs ?? lead.inputs) ||
    takeaways !== (lead.takeaways ?? "")

  function setField(key: keyof CapacityInputs, value: number) {
    setInputs(prev => ({ ...prev, [key]: value }))
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adjustedInputs: inputs, takeaways: takeaways || null }),
      })
      if (res.ok) { setSavedAt("Saved"); router.refresh() }
    } finally { setSaving(false) }
  }

  async function toggleScheduled() {
    const next = !scheduled
    setScheduled(next)
    await fetch(`/api/leads/${lead.id}`, {
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
          /* Force brand colors (verdict box, CTA button) to render in the PDF */
          .report-card, .report-card * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          /* Page 2: notes + scenarios start on a fresh page */
          .page-two { break-before: page; }
        }
        @page { margin: 18mm; }
      `}</style>

      {/* Controls — hidden in print */}
      <div className="no-print" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <a href="/leads" style={{ fontSize: 13, color: "#6B6760", textDecoration: "none" }}>← All leads</a>
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
        {/* Report header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 24, borderBottom: "1px solid #F1ECE3", paddingBottom: 20 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 26, height: 26, borderRadius: 6, background: accent, color: "#fff", fontFamily: "var(--font-cormorant), serif", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>JD</div>
              <span style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 16, fontWeight: 600 }}>Agency Growth OS</span>
            </div>
            <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 26, fontWeight: 600, margin: "0 0 4px", color: "#1A1916" }}>
              Capacity Report — {lead.agency || lead.name || "Agency"}
            </h1>
            <div style={{ fontSize: 13, color: "#9C9590" }}>
              {lead.name ? `${lead.name} · ` : ""}{lead.email} · submitted {new Date(lead.createdAt).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Call to action — near the top so it's visible on view; hidden once the call is booked */}
        {!scheduled && (
          <div style={{ textAlign: "center", background: "#FBF0EB", border: "1px solid #F0C3B0", borderRadius: 10, padding: "18px 20px", marginBottom: 20 }}>
            <div style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 20, fontWeight: 600, color: "#1A1916", marginBottom: 4 }}>
              Ready to grow past your ceiling?
            </div>
            <div style={{ fontSize: 13, color: "#6F6B64", margin: "0 auto 14px", maxWidth: 480, lineHeight: 1.5 }}>
              Book a Growth Projection Review Call and we&apos;ll walk through your numbers together —
              and the specific moves to raise your ceiling.
            </div>
            <a href={schedulingUrl} target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-block", background: accent, color: "#fff", fontSize: 15, fontWeight: 700, textDecoration: "none", borderRadius: 10, padding: "12px 26px" }}>
              Schedule your Growth Projection Review Call →
            </a>
            <div style={{ fontSize: 12, color: "#9C9590", marginTop: 10 }}>{schedulingUrl}</div>
          </div>
        )}

        {/* Verdict */}
        <div style={{ background: capMonthLabel ? "#FBF0EB" : "#F4F7F2", border: `1px solid ${capMonthLabel ? "#F0C3B0" : "#D6E3CE"}`, borderRadius: 10, padding: "16px 18px", marginBottom: 20 }}>
          {capMonthLabel ? (
            <div style={{ fontSize: 15, color: "#1A1916", lineHeight: 1.5 }}>
              At the current pace, delivery capacity caps this agency at{" "}
              <strong style={{ color: accent }}>{fmt$(r.mrrCap!)}/mo</strong> around <strong>{capMonthLabel}</strong>
              {r.maxClients != null && <> (~{r.maxClients} clients)</>}.
              {goalBlockedByCap && (
                <div style={{ marginTop: 6, fontSize: 13, color: "#9A3412" }}>
                  The {fmt$(goal)}/mo goal is above the ceiling — unreachable without more capacity or higher pricing.
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 15, color: "#1A1916", lineHeight: 1.5 }}>
              Not capacity-constrained in the next 12 months at the current pace.
            </div>
          )}
        </div>

        {/* Chart */}
        <div style={{ marginBottom: 24 }}>
          <CapacityChart
            projected={r.projected}
            startValue={inputs.startRevenue}
            mrrCap={r.mrrCap}
            goal={goal}
            capacityHitMonth={r.capacityHitMonth}
            monthLabels={monthLabels}
            currency={lead.currency}
          />
        </div>

        {/* Inputs (editable) */}
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9C9590", marginBottom: 10 }}>Inputs</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 24 }}>
          {FIELDS.map(f => (
            <div key={f.key}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#6B6760", display: "block", marginBottom: 4 }}>
                {f.label}{f.money ? ` ${sym}` : ""}
              </label>
              <input type="number" step={f.step} value={(inputs[f.key] as number) ?? 0}
                onChange={e => setField(f.key, parseFloat(e.target.value) || 0)}
                style={{ padding: "7px 10px", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 13, background: "#FCFBF8", color: "#1A1916", width: "100%", boxSizing: "border-box", fontFamily: "inherit", outline: "none", fontVariantNumeric: "tabular-nums" }} />
            </div>
          ))}
        </div>

        {/* ── Page 2: Notes + scenarios ─────────────────────────────────── */}
        <div className="page-two">
          {/* Notes (editable on screen, rendered as text in the PDF) */}
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9C9590", marginBottom: 10 }}>Notes</div>
          <textarea className="no-print" value={takeaways} onChange={e => setTakeaways(e.target.value)} rows={6}
            placeholder="Add your notes and recommendations here — these appear on the PDF you send to the prospect."
            style={{ width: "100%", boxSizing: "border-box", fontSize: 14, lineHeight: 1.6, color: "#1A1916", border: "1px solid #ECE7DE", borderRadius: 8, padding: "12px 14px", background: "#FCFBF8", resize: "vertical", fontFamily: "inherit" }} />
          <div className="print-only" style={{ fontSize: 14, lineHeight: 1.6, color: "#1A1916", whiteSpace: "pre-wrap" }}>{takeaways}</div>

          {/* Scenarios */}
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9C9590", margin: "26px 0 12px" }}>Ways to grow past your ceiling</div>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {scenarios.map((s, i) => (
              <li key={i} style={{ fontSize: 14, lineHeight: 1.55, marginBottom: 12, color: "#1A1916" }}>
                <strong>{s.label}</strong> → {s.result}.
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
