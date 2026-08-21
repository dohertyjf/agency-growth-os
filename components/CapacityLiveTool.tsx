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
  { key: "churnPct", label: "Churn % / mo", step: 0.5 },
  { key: "hoursPerClient", label: "Avg monthly hours per client", step: 0.5 },
  { key: "billableHours", label: "Billable Hrs / mo", step: 10 },
  { key: "activeClients", label: "Active Clients", step: 1 },
  { key: "goalMRR", label: "MRR Goal", money: true, step: 1000 },
]

const DEFAULTS: Record<string, string> = {
  startRevenue: "20000", leads: "10", closeRate: "20", avgDeal: "3000",
  churnPct: "10", hoursPerClient: "20", billableHours: "320", activeClients: "7", goalMRR: "50000",
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
  // The horizon doubles as the goal deadline — "$50k within 2 years" is one
  // question, not two, so it gets one control.
  const [horizon, setHorizon] = useState(12)

  const num = (s: string) => { const n = parseFloat(s); return isNaN(n) ? 0 : n }
  const inputs = useMemo<CapacityInputs>(() => ({
    startRevenue: num(v.startRevenue), leads: num(v.leads), closeRate: num(v.closeRate),
    avgDeal: num(v.avgDeal), churnPct: num(v.churnPct), hoursPerClient: num(v.hoursPerClient),
    billableHours: num(v.billableHours), activeClients: num(v.activeClients), goalMRR: num(v.goalMRR),
  }), [v])

  const r = useMemo(() => projectCapacity(inputs, horizon), [inputs, horizon])
  const now = useMemo(() => new Date().toISOString().slice(0, 7), [])
  const monthLabels = useMemo(() => Array.from({ length: horizon }, (_, i) => ymLabel(ymAdd(now, i + 1))), [now, horizon])

  // Read-outs under the inputs they are derived from. Churn especially: the user
  // types a client count, the model works in a rate, and without this the
  // conversion is invisible unless a specific verdict branch happens to render.
  const hints = useMemo<Partial<Record<string, string>>>(() => ({
    churnPct: r.churnRate > 0
      ? `\u2248 ${(r.churnRate * inputs.activeClients).toFixed(1)} of ${inputs.activeClients} clients \u00b7 avg stay ${Math.round(1 / r.churnRate)} mo`
      : "no churn — clients stay forever",
    activeClients: inputs.hoursPerClient > 0
      ? `using ${Math.round(r.currentHoursUsed)} of ${inputs.billableHours} hrs`
      : undefined,
    billableHours: r.maxClients != null ? `room for ${r.maxClients} clients` : undefined,
  }), [inputs.activeClients, inputs.hoursPerClient, inputs.billableHours, r])

  // The constraint you would hit next, once the current one is cleared. Skipped
  // when it sits so far above the binding ceiling that plotting it would flatten
  // the projection into the bottom of the chart.
  const secondCeiling = useMemo(() => {
    const other = r.bindingConstraint === "demand" ? r.capacityCeiling : r.demandCeiling
    if (other == null || r.mrrCap == null || other <= r.mrrCap || other > r.mrrCap * 2) return null
    return { value: other, label: r.bindingConstraint === "demand" ? "Capacity ceiling" : "Growth stalls" }
  }, [r])

  const goal = inputs.goalMRR ?? 0
  // Capacity is something you build, not a wall you hit. When it is what binds,
  // say what it has to become and by when.
  const capacityPlan = useMemo(() => {
    if (r.capacityRunsOutMonth < 0 || inputs.billableHours <= 0) return null
    const marks = [11, 23, 35]
      .filter(i => i < horizon && i >= r.capacityRunsOutMonth)
      .map(i => ({ label: monthLabels[i], hrs: r.hoursNeeded[i] }))
    const multiple = r.hoursAtHorizon / inputs.billableHours
    return {
      runsOut: monthLabels[r.capacityRunsOutMonth],
      hrs: r.hoursAtHorizon,
      pct: Math.round((multiple - 1) * 100),
      marks,
    }
  }, [r, inputs.billableHours, monthLabels, horizon])

  const goalVerdict = useMemo(() => {
    if (goal <= 0) return null
    // The goal in clients, not just money — "17 clients" lands where "$50,000"
    // does not, and it sits next to the two counts that decide whether it is
    // even possible: what they have, and what their hours cover.
    const need = inputs.avgDeal > 0 ? Math.ceil(goal / inputs.avgDeal) : null
    const clients = need != null
      ? `That is ${need} clients at ${fmtCurrency(inputs.avgDeal, currency)} each — you have ${inputs.activeClients} today${r.maxClients != null ? `, and your hours cover ${r.maxClients}` : ""}.`
      : null
    const overMax = need != null && r.maxClients != null && need > r.maxClients

    const head = r.goalHitMonth >= 0
      ? { ok: true, text: `You reach ${fmtCurrency(goal, currency)}/mo in ${monthLabels[r.goalHitMonth]} — month ${r.goalHitMonth + 1} of ${horizon}.` }
      : r.mrrCap != null && goal > r.mrrCap
        ? { ok: false, text: `${fmtCurrency(goal, currency)}/mo is above your ceiling of ${fmtCurrency(r.mrrCap, currency)} — no amount of time gets you there without changing something.` }
        : { ok: false, text: `You do not reach ${fmtCurrency(goal, currency)}/mo within ${horizon} months — you get to ${fmtCurrency(r.projected[r.projected.length - 1], currency)}. It is reachable, just not this fast.` }
    return { ...head, clients, overMax }
  }, [goal, r, monthLabels, horizon, currency, inputs.avgDeal, inputs.activeClients])
  const capMonthLabel = r.ceilingHitMonth >= 0 ? monthLabels[r.ceilingHitMonth] : null
  const goalBlockedByCap = goal > 0 && r.mrrCap != null && goal > r.mrrCap

  const scenarios = useMemo(() => {
    const base = r
    const outcome = (patch: Partial<CapacityInputs>) => {
      const res = projectCapacity({ ...inputs, ...patch }, horizon)
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
    const halfChurn = (inputs.churnPct ?? 0) / 2
    const rows = [
      { patch: { avgDeal: inputs.avgDeal * 1.5 }, label: `Raise average client value 50% (to ${fmtCurrency(Math.round(inputs.avgDeal * 1.5), currency)}/mo)` },
      { patch: { hoursPerClient: cut }, label: `Cut hours per client to ${cut} (−25% delivery time)` },
      { patch: { billableHours: inputs.billableHours * 2 }, label: `Double delivery capacity (to ${inputs.billableHours * 2} billable hrs/mo)` },
      { patch: { leads: inputs.leads * 2 }, label: `Double your leads (to ${inputs.leads * 2}/mo)` },
      { patch: { churnPct: halfChurn }, label: `Halve your churn (to ${fmtPercent(halfChurn)}/mo)` },
    ].map(row => ({ ...row, cap: projectCapacity({ ...inputs, ...row.patch }, horizon).mrrCap ?? 0, result: outcome(row.patch) }))
    // Rank to call out the biggest move, but keep the printed order fixed — a
    // list that reshuffles as you type is unreadable.
    const best = Math.max(...rows.map(x => x.cap))
    const baseCap = base.mrrCap ?? 0
    return rows.map(x => ({
      label: x.label,
      result: x.result,
      isBest: x.cap === best && x.cap > baseCap,
      isNoChange: Math.round(x.cap) === Math.round(baseCap),
    }))
  }, [inputs, monthLabels, currency, r, horizon])

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
          <div style={{ display: "flex", border: "1px solid #ECE7DE", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
            {[{ m: 12, label: "1 yr" }, { m: 24, label: "2 yr" }, { m: 36, label: "3 yr" }].map(h => (
              <button key={h.m} onClick={() => setHorizon(h.m)} aria-pressed={horizon === h.m}
                style={{
                  fontSize: 12, fontWeight: 600, padding: "8px 13px", cursor: "pointer", border: "none",
                  background: horizon === h.m ? accent : "transparent",
                  color: horizon === h.m ? "#fff" : "#6B6760",
                }}>
                {h.label}
              </button>
            ))}
          </div>
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

      {goalVerdict && (
        <div style={{ fontSize: 14, lineHeight: 1.5, color: goalVerdict.ok ? "#1F7A4D" : "#9A3412", marginBottom: 20, padding: "0 2px" }}>
          {goalVerdict.ok ? "\u2713 " : "\u2192 "}{goalVerdict.text}
          {goalVerdict.clients && (
            <div style={{ color: goalVerdict.overMax ? "#9A3412" : "#6B6760", marginTop: 4 }}>
              {goalVerdict.clients}
              {goalVerdict.overMax && <strong> More than your team can serve at these hours.</strong>}
            </div>
          )}
        </div>
      )}

      {capacityPlan && (
        <div style={{ background: "#F5F1EC", border: "1px solid #ECE7DE", borderRadius: 10, padding: "13px 16px", marginBottom: 20 }}>
          <div style={{ fontSize: 14, lineHeight: 1.5, color: "#1A1916" }}>
            Delivery capacity runs out around <strong>{capacityPlan.runsOut}</strong>. To keep growing past it you
            need <strong>{capacityPlan.hrs} billable hrs/mo</strong> by {monthLabels[horizon - 1]}
            {capacityPlan.pct > 0 && <> — {capacityPlan.pct}% more than today</>}.
          </div>
          {capacityPlan.marks.length > 1 && (
            <div style={{ fontSize: 12, color: "#6B6760", marginTop: 7, fontVariantNumeric: "tabular-nums" }}>
              {capacityPlan.marks.map((m, i) => (
                <span key={m.label}>{i > 0 && <span style={{ color: "#C9C4BC" }}> · </span>}{m.label}: <strong>{m.hrs} hrs</strong></span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Chart */}
      <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <CapacityChart
          projected={r.projected}
          startValue={inputs.startRevenue}
          mrrCap={r.mrrCap}
          goal={goal}
          ceilingHitMonth={r.ceilingHitMonth}
          ceilingLabel={r.bindingConstraint === "demand" ? "Growth stalls" : "Capacity ceiling"}
          secondCeiling={secondCeiling}
          monthLabels={monthLabels}
          currency={currency}
        />
      </div>

      {/* Scenarios */}
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9C9590", margin: "0 0 12px" }}>Ways to grow past the ceiling</div>
      <ul style={{ margin: 0, paddingLeft: 20 }}>
        {scenarios.map((s, i) => (
          <li key={i} style={{ fontSize: 14, lineHeight: 1.55, marginBottom: 12, color: s.isNoChange ? "#9C9590" : "#1A1916" }}>
            <strong>{s.label}</strong> → {s.result}.
            {s.isBest && (
              <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: "#fff", background: accent, borderRadius: 5, padding: "2px 7px", whiteSpace: "nowrap" }}>
                biggest lever right now
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
