"use client"
import { useMemo, useState } from "react"
import { projectCapacity, fmtCurrency, fmtPercent, ymAdd, ymLabel, type CapacityInputs } from "@/lib/calc"
import CapacityChart from "@/components/CapacityChart"

type Currency = "USD" | "GBP" | "EUR"
function currSym(c: Currency) { return c === "GBP" ? "£" : c === "EUR" ? "€" : "$" }

const accent = "#E9532A"
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "#6B6760", display: "block", marginBottom: 4 }
const inputStyle: React.CSSProperties = {
  padding: "8px 11px", border: "1px solid #ECE7DE", borderRadius: 8, fontSize: 14,
  background: "#FCFBF8", color: "#1A1916", width: "100%", boxSizing: "border-box", fontFamily: "inherit", outline: "none",
  fontVariantNumeric: "tabular-nums",
}

const FIELDS: { key: keyof CapacityInputs; label: string; money?: boolean; step?: number }[] = [
  { key: "startRevenue", label: "Current Revenue / mo", money: true, step: 500 },
  { key: "leads", label: "Leads / mo", step: 0.5 },
  { key: "closeRate", label: "Close Rate %", step: 0.1 },
  { key: "avgDeal", label: "Avg Deal Size / mo", money: true, step: 100 },
  { key: "churn", label: "Churn / mo (clients)", step: 0.5 },
  { key: "hoursPerClient", label: "Avg monthly hours per client", step: 0.5 },
  { key: "billableHours", label: "Billable Hrs / mo", step: 10 },
  { key: "activeClients", label: "Active Clients", step: 1 },
  { key: "goalMRR", label: "MRR Goal", money: true, step: 1000 },
]

const DEFAULTS: Record<string, string> = {
  startRevenue: "20000", leads: "10", closeRate: "20", avgDeal: "3000",
  churn: "1", hoursPerClient: "20", billableHours: "320", activeClients: "7", goalMRR: "50000",
}

interface Props {
  /** Headline above the tool. Defaults to the coach-facing sales-call framing. */
  title?: string
  /** Sub-line under the headline. */
  subtitle?: string
}

export default function CapacityLiveTool({
  title = "Growth Projection — live",
  subtitle = "Type a prospect's numbers and adjust live on a call. Nothing is saved.",
}: Props = {}) {
  const [currency, setCurrency] = useState<Currency>("USD")
  const sym = currSym(currency)
  const fmt$ = (val: number) => fmtCurrency(val, currency)
  const [v, setV] = useState<Record<string, string>>(DEFAULTS)

  const num = (s: string) => { const n = parseFloat(s); return isNaN(n) ? 0 : n }
  const inputs = useMemo<CapacityInputs>(() => ({
    startRevenue: num(v.startRevenue), leads: num(v.leads), closeRate: num(v.closeRate),
    avgDeal: num(v.avgDeal), churn: num(v.churn), hoursPerClient: num(v.hoursPerClient),
    billableHours: num(v.billableHours), activeClients: num(v.activeClients), goalMRR: num(v.goalMRR),
  }), [v])

  const r = useMemo(() => projectCapacity(inputs), [inputs])
  const now = useMemo(() => new Date().toISOString().slice(0, 7), [])
  const monthLabels = useMemo(() => Array.from({ length: 12 }, (_, i) => ymLabel(ymAdd(now, i + 1))), [now])

  // Read-outs under the inputs they are derived from. Churn especially: the user
  // types a client count, the model works in a rate, and without this the
  // conversion is invisible unless a specific verdict branch happens to render.
  const hints = useMemo<Partial<Record<string, string>>>(() => ({
    churn: inputs.activeClients > 0
      ? `= ${fmtPercent(r.churnRate * 100)} of your clients a month`
      : "set Active Clients to read this as a rate",
    activeClients: inputs.hoursPerClient > 0
      ? `using ${Math.round(r.currentHoursUsed)} of ${inputs.billableHours} hrs`
      : undefined,
    billableHours: r.maxClients != null ? `room for ${r.maxClients} clients` : undefined,
  }), [inputs.activeClients, inputs.hoursPerClient, inputs.billableHours, r])

  const goal = inputs.goalMRR ?? 0
  const capMonthLabel = r.ceilingHitMonth >= 0 ? monthLabels[r.ceilingHitMonth] : null
  const goalBlockedByCap = goal > 0 && r.mrrCap != null && goal > r.mrrCap

  const scenarios = useMemo(() => {
    const base = r
    const outcome = (patch: Partial<CapacityInputs>) => {
      const res = projectCapacity({ ...inputs, ...patch })
      if (res.mrrCap == null) return "removes the ceiling entirely"
      // A lever that does not move the binding ceiling is the most useful thing
      // this list can tell you — say so plainly instead of reporting a "lift"
      // to the number it already was.
      if (base.mrrCap != null && Math.round(res.mrrCap) === Math.round(base.mrrCap)) {
        return res.bindingConstraint === "demand"
          ? `no change — churn still caps you at ${fmtCurrency(res.mrrCap, currency)}`
          : `no change — capacity still caps you at ${fmtCurrency(res.mrrCap, currency)}`
      }
      const direction = base.mrrCap != null && res.mrrCap < base.mrrCap ? "lowers" : "lifts"
      return res.ceilingHitMonth >= 0
        ? `${direction} the ceiling to ${fmtCurrency(res.mrrCap, currency)}, reached ${monthLabels[res.ceilingHitMonth]}`
        : `${direction} the ceiling to ${fmtCurrency(res.mrrCap, currency)} — beyond the projection`
    }
    const cut = Math.max(1, Math.round(inputs.hoursPerClient * 0.75))
    return [
      { label: `Raise average client value 50% (to ${fmtCurrency(Math.round(inputs.avgDeal * 1.5), currency)}/mo)`, result: outcome({ avgDeal: inputs.avgDeal * 1.5 }) },
      { label: `Cut hours per client to ${cut} (−25% delivery time)`, result: outcome({ hoursPerClient: cut }) },
      { label: `Double delivery capacity (to ${inputs.billableHours * 2} billable hrs/mo)`, result: outcome({ billableHours: inputs.billableHours * 2 }) },
      { label: `Double your leads (to ${inputs.leads * 2}/mo)`, result: outcome({ leads: inputs.leads * 2 }) },
    ]
  }, [inputs, monthLabels, currency, r])

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 28, fontWeight: 600, margin: "0 0 4px", color: "#1A1916" }}>
            {title}
          </h1>
          <p style={{ fontSize: 13, color: "#9C9590", margin: 0 }}>{subtitle}</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={currency} onChange={e => setCurrency(e.target.value as Currency)}
            style={{ ...inputStyle, width: "auto", padding: "8px 12px", cursor: "pointer" }} aria-label="Currency">
            <option value="USD">$ USD</option><option value="GBP">£ GBP</option><option value="EUR">€ EUR</option>
          </select>
          <button onClick={() => setV(DEFAULTS)}
            style={{ fontSize: 12, fontWeight: 600, color: "#9C9590", background: "#fff", border: "1px solid #ECE7DE", borderRadius: 7, padding: "8px 14px", cursor: "pointer" }}>
            Reset
          </button>
        </div>
      </div>

      {/* Inputs */}
      <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14 }}>
          {FIELDS.map(f => (
            <div key={f.key}>
              <label style={labelStyle}>{f.label}{f.money ? ` ${sym}` : ""}</label>
              <input type="number" min={0} step={f.step} value={v[f.key]}
                onChange={e => setV(prev => ({ ...prev, [f.key]: e.target.value }))} style={inputStyle} />
              {hints[f.key] && (
                <div style={{ fontSize: 10, color: "#9C9590", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
                  {hints[f.key]}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Verdict */}
      <div style={{ background: capMonthLabel ? "#FBF0EB" : "#F4F7F2", border: `1px solid ${capMonthLabel ? "#F0C3B0" : "#D6E3CE"}`, borderRadius: 12, padding: "18px 20px", marginBottom: 20 }}>
        {capMonthLabel ? (
          <div style={{ fontSize: 16, color: "#1A1916", lineHeight: 1.5 }}>
            {r.bindingConstraint === "demand" ? (
              <>
                At this pace growth stalls at{" "}
                <strong style={{ color: accent }}>{fmt$(r.mrrCap!)}/mo</strong> around <strong>{capMonthLabel}</strong>
                {" "}— you start losing clients as fast as you win them
                {r.churnRate > 0 && <> (churn is <strong>{fmtPercent(r.churnRate * 100)}</strong> a month)</>}.
                {r.capacityCeiling != null && (
                  <div style={{ marginTop: 8, fontSize: 14, color: "#6F6B64" }}>
                    Your team could deliver {fmt$(r.capacityCeiling)}/mo, so hiring is not the fix here — retention is.
                  </div>
                )}
              </>
            ) : (
              <>
                At this pace your delivery capacity caps you at{" "}
                <strong style={{ color: accent }}>{fmt$(r.mrrCap!)}/mo</strong> around <strong>{capMonthLabel}</strong>
                {r.maxClients != null && <> — about <strong>{r.maxClients} clients</strong>, all the billable hours your team has</>}.
              </>
            )}
            {goalBlockedByCap && (
              <div style={{ marginTop: 8, fontSize: 14, color: "#9A3412" }}>
                ⚠ The {fmt$(goal)}/mo goal is above that ceiling — unreachable without{" "}
                {r.bindingConstraint === "demand" ? "better retention, more leads, or higher pricing" : "more capacity or higher pricing"}.
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 16, color: "#1A1916", lineHeight: 1.5 }}>
            {r.mrrCap != null ? (
              <>
                Still climbing at the end of the projection — {fmt$(r.projected[r.projected.length - 1])}/mo by{" "}
                <strong>{monthLabels[monthLabels.length - 1]}</strong>, heading toward a ceiling of{" "}
                <strong style={{ color: accent }}>{fmt$(r.mrrCap)}/mo</strong>
                {r.bindingConstraint === "demand"
                  ? <> set by churn, not by your team&apos;s capacity.</>
                  : <> set by your delivery capacity.</>}
              </>
            ) : (
              <>Nothing caps this model at these settings — no churn and no capacity limit, so revenue grows without bound. Add a churn figure or billable hours to find the ceiling.</>
            )}
          </div>
        )}
      </div>

      {/* Chart */}
      <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <CapacityChart
          projected={r.projected}
          startValue={inputs.startRevenue}
          mrrCap={r.mrrCap}
          goal={goal}
          ceilingHitMonth={r.ceilingHitMonth}
          ceilingLabel={r.bindingConstraint === "demand" ? "Growth stalls" : "Capacity ceiling"}
          monthLabels={monthLabels}
          currency={currency}
        />
      </div>

      {/* Scenarios */}
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9C9590", margin: "0 0 12px" }}>Ways to grow past the ceiling</div>
      <ul style={{ margin: 0, paddingLeft: 20 }}>
        {scenarios.map((s, i) => (
          <li key={i} style={{ fontSize: 14, lineHeight: 1.55, marginBottom: 12, color: "#1A1916" }}>
            <strong>{s.label}</strong> → {s.result}.
          </li>
        ))}
      </ul>
    </div>
  )
}
