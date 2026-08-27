"use client"
import { useCallback, useMemo, useState } from "react"
import { projectCapacity, projectSchedule, fmtCurrency, fmtPercent, ymAdd, ymLabel, type CapacityInputs, type MonthDrivers } from "@/lib/calc"
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

type Mode = "prescribe" | "diagnose"

interface Props {
  /**
   * "prescribe" hands over the full plan — what to change, by how much, in what
   * order. Right for a workshop or your own analysis.
   * "diagnose" states the gap and names the constraint but withholds the fix.
   * Right for a sales conversation, where the page should not answer the
   * question you are there to answer.
   */
  mode?: Mode
  /** Headline above the tool. Defaults to the coach-facing sales-call framing. */
  title?: string
  /** Sub-line under the headline. */
  subtitle?: string
  /** Booking link for the diagnose-mode call to action. */
  schedulingUrl?: string
  /** Months shown on load. */
  defaultHorizon?: number
}


type Lever = {
  key: string
  label: string
  patch: Partial<CapacityInputs>
  /** Which ceiling this lever actually moves. */
  addresses: ("capacity" | "demand")[]
}

// Defined against a given state rather than the user's original inputs, so the
// sequence can stack moves — step two's "double capacity" is relative to what
// step one left behind.
function leversFor(inp: CapacityInputs, currency: string): Lever[] {
  const cut = Math.max(1, Math.round(inp.hoursPerClient * 0.75))
  const halfChurn = (inp.churnPct ?? 0) / 2
  return [
    { key: "price", label: `Raise average client value 50% (to ${fmtCurrency(Math.round(inp.avgDeal * 1.5), currency)}/mo)`,
      patch: { avgDeal: inp.avgDeal * 1.5 }, addresses: ["capacity", "demand"] },
    { key: "hours", label: `Cut hours per client to ${cut} (−25% delivery time)`,
      patch: { hoursPerClient: cut }, addresses: ["capacity"] },
    { key: "capacity", label: `Double delivery capacity (to ${inp.billableHours * 2} billable hrs/mo)`,
      patch: { billableHours: inp.billableHours * 2 }, addresses: ["capacity"] },
    { key: "leads", label: `Double your leads (to ${inp.leads * 2}/mo)`,
      patch: { leads: inp.leads * 2 }, addresses: ["demand"] },
    { key: "churn", label: `Halve your churn (to ${fmtPercent(halfChurn)}/mo)`,
      patch: { churnPct: halfChurn }, addresses: ["demand"] },
  ]
}

export default function CapacityLiveTool({
  mode = "prescribe",
  schedulingUrl = "",
  defaultHorizon = 12,
  title = "Growth Projection — live",
  subtitle = "Type a prospect's numbers and adjust live on a call. Nothing is saved.",
}: Props = {}) {
  const [currency, setCurrency] = useState<Currency>("USD")
  const sym = currSym(currency)
  const fmt$ = (val: number) => fmtCurrency(val, currency)
  const [v, setV] = useState<Record<string, string>>(DEFAULTS)
  // The horizon doubles as the goal deadline — "$50k within 2 years" is one
  // question, not two, so it gets one control.
  const [horizon, setHorizon] = useState(defaultHorizon)
  const num = (s: string) => { const n = parseFloat(s); return isNaN(n) ? 0 : n }
  const inputs = useMemo<CapacityInputs>(() => ({
    startRevenue: num(v.startRevenue), leads: num(v.leads), closeRate: num(v.closeRate),
    avgDeal: num(v.avgDeal), churnPct: num(v.churnPct), hoursPerClient: num(v.hoursPerClient),
    billableHours: num(v.billableHours), activeClients: num(v.activeClients), goalMRR: num(v.goalMRR),
  }), [v])

  // Per-month driver overrides, keyed by 0-based month index. An entry applies
  // from that month onward until another entry supersedes it — so typing a
  // close rate into month 4 means "from month 4, this is the rate", which is how
  // a change that takes time to land actually behaves.
  const [overrides, setOverrides] = useState<Record<number, Partial<MonthDrivers>>>({})
  const [tableOpen, setTableOpen] = useState(true)
  const hasOverrides = Object.keys(overrides).length > 0

  const driversAt = useCallback((i: number): MonthDrivers => {
    const d: MonthDrivers = {
      leads: inputs.leads, closeRate: inputs.closeRate,
      avgDeal: inputs.avgDeal, churnPct: inputs.churnPct ?? 0,
    }
    for (let m = 0; m <= i; m++) {
      const o = overrides[m]
      if (o) Object.assign(d, o)
    }
    return d
  }, [inputs, overrides])

  const rows = useMemo(
    () => projectSchedule(inputs.startRevenue, driversAt, inputs.hoursPerClient, inputs.billableHours, horizon),
    [inputs.startRevenue, inputs.hoursPerClient, inputs.billableHours, horizon, driversAt]
  )
  const editedPath = useMemo(() => rows.map(x => x.mrr), [rows])

  function setOverride(monthIdx: number, key: keyof MonthDrivers, raw: string) {
    const n = parseFloat(raw)
    setOverrides(prev => {
      const next = { ...prev }
      const cur = { ...(next[monthIdx] ?? {}) }
      if (raw.trim() === "" || isNaN(n)) delete cur[key]
      else cur[key] = n
      if (Object.keys(cur).length === 0) delete next[monthIdx]
      else next[monthIdx] = cur
      return next
    })
  }

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
    avgDeal: "the price you sell new clients at",
    activeClients: inputs.activeClients > 0
      ? `today's average ${fmtCurrency(Math.round(inputs.startRevenue / inputs.activeClients), currency)}/client`
        + (inputs.hoursPerClient > 0
            ? ` \u00b7 ${Math.round(r.currentHoursUsed)} of ${inputs.billableHours} hrs`
              + (r.slotsAvailable != null ? ` \u00b7 ${r.slotsAvailable > 0 ? `${r.slotsAvailable} open` : "at capacity"}` : "")
            : "")
      : undefined,
    billableHours: r.maxClients != null ? `room for ${r.maxClients} clients` : undefined,
  }), [inputs.activeClients, inputs.hoursPerClient, inputs.billableHours, inputs.startRevenue, currency, r])

  // The constraint you would hit next, once the current one is cleared. Skipped
  // when it sits so far above the binding ceiling that plotting it would flatten
  // the projection into the bottom of the chart.
  // Both ceilings are functions of the drivers, so editing the table moves them.
  // Once drivers vary by month there is no single ceiling — the honest summary is
  // the one implied by where the drivers END UP, which is the state the
  // projection is settling into. With no edits this is exactly `r`.
  const shown = useMemo(() => {
    if (!hasOverrides) return r
    const last = driversAt(horizon - 1)
    return projectCapacity({ ...inputs, ...last }, horizon)
  }, [hasOverrides, r, inputs, driversAt, horizon])

  const secondCeiling = useMemo(() => {
    const other = shown.bindingConstraint === "demand" ? shown.capacityCeiling : shown.demandCeiling
    if (other == null || shown.mrrCap == null || other <= shown.mrrCap || other > shown.mrrCap * 2) return null
    return { value: other, label: shown.bindingConstraint === "demand" ? "Capacity ceiling" : "Churn ceiling" }
  }, [shown])

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

  // Once the table has been edited, describing the untouched numbers is simply
  // wrong. Summarise what was actually changed: for each driver, the value it
  // ends on and the month it starts applying from — which is the whole point of
  // editing at a month rather than at the top.
  const editSummary = useMemo(() => {
    if (!hasOverrides || goal <= 0) return null
    const final = driversAt(horizon - 1)
    const order: (keyof MonthDrivers)[] = ["closeRate", "avgDeal", "leads", "churnPct"]
    const parts: string[] = []
    for (const k of order) {
      let lastIdx = -1
      for (const key of Object.keys(overrides)) {
        const m = Number(key)
        if (overrides[m]?.[k] != null && m > lastIdx) lastIdx = m
      }
      if (lastIdx < 0) continue
      const v = final[k]
      const label =
        k === "leads" ? `leads at ${Math.round(v)}/mo`
        : k === "closeRate" ? `close rate at ${fmtPercent(v)}`
        : k === "avgDeal" ? `average deal at ${fmtCurrency(Math.round(v), currency)}`
        : `churn at ${fmtPercent(v)}`
      parts.push(`${label} from ${monthLabels[lastIdx]}`)
    }
    if (parts.length === 0) return null
    const list = parts.length === 1 ? parts[0]
      : parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1]
    const hit = rows.findIndex(x => x.mrr >= goal)
    return { list, hitMonth: hit >= 0 ? monthLabels[hit] : null, end: rows[rows.length - 1].mrr }
  }, [hasOverrides, goal, overrides, driversAt, horizon, monthLabels, currency, rows])

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

  // The cost of changing nothing: how far short of their own goal they run,
  // every month, added up. It is a far larger and more concrete number than the
  // ceiling, and the model already had it — it was just never shown.
  const inaction = useMemo(() => {
    if (goal <= 0 || r.mrrCap == null) return null
    const shortfall = r.projected.reduce((sum, v) => sum + Math.max(0, goal - v), 0)
    if (shortfall <= 0) return null
    return {
      shortfall,
      endGap: Math.max(0, goal - r.projected[r.projected.length - 1]),
      neverReaches: r.goalHitMonth < 0,
      years: Math.round(horizon / 12),
    }
  }, [goal, r, horizon])

  // The smallest price rise that actually reaches the goal, given everything
  // else they typed. Raising price lifts both ceilings and speeds the climb, so
  // the outcome is monotonic in price and a binary search is safe.
  const minPriceRise = useMemo(() => {
    if (goal <= 0 || inputs.avgDeal <= 0 || r.goalHitMonth >= 0) return null
    const reaches = (mult: number) =>
      projectCapacity({ ...inputs, avgDeal: inputs.avgDeal * mult }, horizon).goalHitMonth >= 0
    const CEILING = 10
    if (!reaches(CEILING)) return null   // price alone cannot get there

    let lo = 1, hi = CEILING
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2
      if (reaches(mid)) hi = mid; else lo = mid
    }
    // Round the percentage up, then price from that, so the figure shown is one
    // that genuinely works rather than the bare mathematical boundary.
    const pct = Math.max(1, Math.ceil((hi - 1) * 100))
    const price = Math.ceil(inputs.avgDeal * (1 + pct / 100))
    const res = projectCapacity({ ...inputs, avgDeal: price }, horizon)
    if (res.goalHitMonth < 0) return null
    return { pct, price, month: monthLabels[res.goalHitMonth] }
  }, [inputs, goal, r, horizon, monthLabels])

  // The order to pull the levers in. At each step only moves that address the
  // ceiling currently binding are considered — recommending "fix churn" to an
  // agency that is out of delivery hours is how people waste a year. Apply the
  // winner, recompute, and let the next constraint pick the next move.
  const sequence = useMemo(() => {
    if (goal <= 0 || r.goalHitMonth >= 0) return null
    // If a price rise alone reaches the goal, that is the whole plan — and it
    // should quote the rise actually needed, not the generic 50% the lever list
    // uses for comparison.
    if (minPriceRise) {
      return [{
        label: `Raise prices ${minPriceRise.pct}% (to ${fmtCurrency(minPriceRise.price, currency)}/mo per client)`,
        ceiling: projectCapacity({ ...inputs, avgDeal: minPriceRise.price }, horizon).mrrCap ?? 0,
        binds: null,
        reached: minPriceRise.month,
      }]
    }
    let state: CapacityInputs = inputs
    const used = new Set<string>()
    const steps: { label: string; ceiling: number; binds: "capacity" | "demand" | null; reached: string | null }[] = []

    for (let i = 0; i < 4; i++) {
      const cur = projectCapacity(state, horizon)
      if (cur.goalHitMonth >= 0 || cur.bindingConstraint == null) break

      let best: { lever: Lever; res: ReturnType<typeof projectCapacity> } | null = null
      for (const lever of leversFor(state, currency)) {
        if (used.has(lever.key)) continue
        if (!lever.addresses.includes(cur.bindingConstraint)) continue
        const res = projectCapacity({ ...state, ...lever.patch }, horizon)
        // Ignore moves that do not meaningfully lift the binding ceiling.
        if ((res.mrrCap ?? 0) <= (cur.mrrCap ?? 0) + 1) continue
        if (best == null || (res.mrrCap ?? 0) > (best.res.mrrCap ?? 0)) best = { lever, res }
      }
      if (best == null) break

      used.add(best.lever.key)
      state = { ...state, ...best.lever.patch }
      steps.push({
        label: best.lever.label,
        ceiling: best.res.mrrCap ?? 0,
        binds: best.res.bindingConstraint,
        reached: best.res.goalHitMonth >= 0 ? monthLabels[best.res.goalHitMonth] : null,
      })
      if (best.res.goalHitMonth >= 0) break
    }
    return steps.length > 0 ? steps : null
  }, [inputs, goal, r, horizon, currency, monthLabels, minPriceRise])

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
    const rows = leversFor(inputs, currency)
      .map(row => ({ ...row, cap: projectCapacity({ ...inputs, ...row.patch }, horizon).mrrCap ?? 0, result: outcome(row.patch) }))
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

  // The levers that will not move the binding ceiling. In a sales conversation
  // this is the useful half: it takes away the plan they walked in with.
  const deadLevers = useMemo(
    () => scenarios.filter(x => x.isNoChange).map(x => x.label),
    [scenarios]
  )
  const liveLeverCount = scenarios.length - deadLevers.length

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

      {mode === "diagnose" && inaction && (
        <div style={{ background: "#1A1916", color: "#fff", borderRadius: 12, padding: "22px 24px", marginBottom: 20 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 28, alignItems: "flex-end" }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9C9590", marginBottom: 6 }}>
                Left on the table by {monthLabels[horizon - 1]}
              </div>
              <div style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 46, fontWeight: 600, lineHeight: 1, color: "#F0A088" }}>
                {fmt$(inaction.shortfall)}
              </div>
              <div style={{ fontSize: 13, color: "#C9C4BC", marginTop: 6 }}>
                against the {fmt$(goal)}/mo you just told us you want
              </div>
            </div>
            {minPriceRise && (
              <div style={{ borderLeft: "1px solid #3A3833", paddingLeft: 28 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9C9590", marginBottom: 6 }}>
                  What it would take
                </div>
                <div style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 46, fontWeight: 600, lineHeight: 1, color: "#fff" }}>
                  {minPriceRise.pct}%
                </div>
                <div style={{ fontSize: 13, color: "#C9C4BC", marginTop: 6 }}>
                  on price — {fmtCurrency(minPriceRise.price, currency)} instead of {fmtCurrency(inputs.avgDeal, currency)}
                </div>
              </div>
            )}
          </div>
          {!minPriceRise && (
            <div style={{ fontSize: 15, lineHeight: 1.55, color: "#C9C4BC", marginTop: 12 }}>
              {inaction.neverReaches
                ? <>Price alone will not close this one — the gap is wider than a rate change can cover.</>
                : <>You get there, but the same model stops at {fmt$(r.mrrCap!)}/mo. The goal is not the ceiling.</>}
            </div>
          )}
          {deadLevers.length > 0 && (
            <div style={{ marginTop: 20, borderTop: "1px solid #3A3833", paddingTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9C9590", marginBottom: 8 }}>
                What will not close it
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.7, color: "#E6E1D9" }}>
                {deadLevers.map(l => <li key={l}>{l}</li>)}
              </ul>
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
          projected={editedPath}
          baseline={hasOverrides ? r.projected : null}
          startValue={inputs.startRevenue}
          mrrCap={shown.mrrCap}
          goal={goal}
          ceilingHitMonth={r.ceilingHitMonth}
          ceilingLabel={shown.bindingConstraint === "demand" ? "Churn ceiling" : "Capacity ceiling"}
          secondCeiling={secondCeiling}
          monthLabels={monthLabels}
          startLabel={ymLabel(now)}
          currency={currency}
        />
      </div>

      <div style={{ marginBottom: 24 }}>
        <button type="button" onClick={() => setTableOpen(o => !o)}
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9C9590", fontFamily: "inherit" }}>
          {tableOpen ? "▾" : "▸"} Month by month{hasOverrides ? " · edited" : ""}
        </button>
        {hasOverrides && (
          <button type="button" onClick={() => setOverrides({})}
            style={{ marginLeft: 12, background: "none", border: "1px solid #ECE7DE", borderRadius: 6, padding: "2px 9px", cursor: "pointer", fontSize: 11, color: "#9C9590", fontFamily: "inherit" }}>
            reset changes
          </button>
        )}
        {tableOpen && (
          <div style={{ marginTop: 10, border: "1px solid #ECE7DE", borderRadius: 10, background: "#fff", maxHeight: 420, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
              <thead>
                <tr style={{ position: "sticky", top: 0, background: "#F5F1EC", zIndex: 1 }}>
                  {["Month", "Leads", "Close %", "Avg deal", "Churn %", "Won", "Lost", "Clients", "MRR"].map((h, i) => (
                    <th key={h} style={{ textAlign: i === 0 ? "left" : "right", padding: "7px 9px", fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "#6B6760", whiteSpace: "nowrap", borderBottom: "1px solid #ECE7DE" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const edited = overrides[i]
                  const cell = (key: keyof MonthDrivers, val: number, step: number) => (
                    <td style={{ textAlign: "right", padding: "2px 4px", borderBottom: "1px solid #F5F1EC" }}>
                      <input
                        type="number" step={step} value={String(Math.round(val * 100) / 100)}
                        onChange={e => setOverride(i, key, e.target.value)}
                        style={{
                          width: 72, textAlign: "right", fontFamily: "inherit", fontSize: 12,
                          padding: "4px 6px", borderRadius: 5, outline: "none",
                          border: `1px solid ${edited?.[key] != null ? accent : "transparent"}`,
                          background: edited?.[key] != null ? "#FBF0EB" : "transparent",
                          color: "#1A1916", fontVariantNumeric: "tabular-nums",
                        }} />
                    </td>
                  )
                  return (
                    <tr key={i} style={{ background: row.atCeiling ? "#FAF8F4" : "#fff" }}>
                      <td style={{ padding: "2px 9px", color: "#6B6760", whiteSpace: "nowrap", borderBottom: "1px solid #F5F1EC" }}>{monthLabels[i]}</td>
                      {cell("leads", row.leads, 1)}
                      {cell("closeRate", row.closeRate, 1)}
                      {cell("avgDeal", row.avgDeal, 100)}
                      {cell("churnPct", row.churnPct, 0.5)}
                      <td style={{ textAlign: "right", padding: "2px 9px", color: "#1F7A4D", borderBottom: "1px solid #F5F1EC" }}>+{row.won.toFixed(1)}</td>
                      <td style={{ textAlign: "right", padding: "2px 9px", color: "#9A3412", borderBottom: "1px solid #F5F1EC" }}>−{row.churnedClients.toFixed(1)}</td>
                      <td style={{ textAlign: "right", padding: "2px 9px", color: "#1A1916", fontWeight: 600, borderBottom: "1px solid #F5F1EC" }}>{row.clients.toFixed(1)}</td>
                      <td style={{ textAlign: "right", padding: "2px 9px", color: "#1A1916", fontWeight: 600, whiteSpace: "nowrap", borderBottom: "1px solid #F5F1EC" }}>{fmt$(row.mrr)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {tableOpen && (
          <div style={{ fontSize: 11, color: "#9C9590", marginTop: 7, lineHeight: 1.5 }}>
            Change a number and it applies from that month onward — that is how you model a change that takes time to land.
            Won, lost, clients and MRR are calculated. Shaded rows are at the ceiling.
          </div>
        )}
      </div>

      {editSummary ? (
        <div style={{ fontSize: 15, lineHeight: 1.55, marginBottom: 20, padding: "0 2px", color: editSummary.hitMonth ? "#1F7A4D" : "#9A3412" }}>
          {editSummary.hitMonth ? (
            <>&#10003; You reach <strong>{fmt$(goal)}/mo</strong> by <strong>{editSummary.hitMonth}</strong> — with {editSummary.list}.</>
          ) : (
            <>&#8594; Even with {editSummary.list}, you do not reach {fmt$(goal)}/mo — you end on <strong>{fmt$(editSummary.end)}/mo</strong>.</>
          )}
        </div>
      ) : goalVerdict && (
        <div style={{ fontSize: 14, lineHeight: 1.5, color: goalVerdict.ok ? "#1F7A4D" : "#9A3412", marginBottom: 20, padding: "0 2px" }}>
          {goalVerdict.ok ? "\u2713 " : "\u2192 "}{goalVerdict.text}
          {mode === "prescribe" && minPriceRise && (
            <div style={{ color: "#1F7A4D", marginTop: 4, fontWeight: 600 }}>
              A {minPriceRise.pct}% price rise gets you there — {fmtCurrency(minPriceRise.price, currency)}/mo per client, reaching {fmt$(goal)} by {minPriceRise.month}.
            </div>
          )}
          {goalVerdict.clients && (
            <div style={{ color: goalVerdict.overMax ? "#9A3412" : "#6B6760", marginTop: 4 }}>
              {goalVerdict.clients}
              {goalVerdict.overMax && <strong> More than your team can serve at these hours.</strong>}
            </div>
          )}
        </div>
      )}

      {/* Scenarios */}
      {mode === "diagnose" && inaction && (
        <div style={{ border: `1px solid ${accent}`, borderRadius: 12, padding: "20px 22px", marginBottom: 24, background: "#FBF0EB" }}>
          <div style={{ fontSize: 16, lineHeight: 1.55, color: "#1A1916" }}>
            None of this is complicated. If it were only about knowing the number, you would already be there.
          </div>
          {schedulingUrl && (
            <a href={schedulingUrl} target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-block", marginTop: 15, fontSize: 15, fontWeight: 600, color: "#fff", background: accent, borderRadius: 9, padding: "12px 26px", textDecoration: "none" }}>
              Talk through what is actually stopping you →
            </a>
          )}
        </div>
      )}

      {mode === "prescribe" && sequence && (
        <div style={{ marginBottom: 26 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9C9590", margin: "0 0 12px" }}>
            In what order — your path to {fmt$(goal)}/mo
          </div>
          <ol style={{ margin: 0, paddingLeft: 0, listStyle: "none", counterReset: "step" }}>
            {sequence.map((st, i) => (
              <li key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 10 }}>
                <span style={{ flex: "0 0 auto", width: 22, height: 22, borderRadius: 11, background: st.reached ? "#1F7A4D" : accent, color: "#fff", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                  {i + 1}
                </span>
                <span style={{ fontSize: 14, lineHeight: 1.55, color: "#1A1916" }}>
                  <strong>{st.label}</strong> → takes you to <strong>{fmt$(st.ceiling)}/mo</strong>.
                  {st.reached
                    ? <span style={{ color: "#1F7A4D", fontWeight: 600 }}> Goal reached {st.reached}.</span>
                    : <span style={{ color: "#6B6760" }}> {st.binds === "demand" ? "Churn becomes the constraint." : "Delivery capacity becomes the constraint."}</span>}
                </span>
              </li>
            ))}
          </ol>
          {!sequence[sequence.length - 1].reached && (
            // Two different failures: the ceiling is still too low, or the
            // ceiling clears but the projection cannot climb that far in time.
            sequence[sequence.length - 1].ceiling >= goal ? (
              <div style={{ fontSize: 13, color: "#6B6760", marginTop: 8 }}>
                That puts {fmt$(goal)}/mo within reach — but not within {horizon} months. Try a longer horizon.
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "#9A3412", marginTop: 8 }}>
                Even after all of these, {fmt$(goal)}/mo is still above the ceiling — it needs a bigger change than any single move here.
              </div>
            )
          )}
        </div>
      )}

{mode === "prescribe" && (<>
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
      </>)}
    </div>
  )
}
