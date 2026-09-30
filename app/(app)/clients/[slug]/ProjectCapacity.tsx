"use client"
import { useMemo, useRef, useState } from "react"
import Link from "next/link"
import type { DeliveryRow } from "@/lib/calc"
import { currentWeek } from "@/lib/weeks"
import {
  weeksFrom, projectHoursByWeek, teamCapacityByWeek, fteWeeklyHours, firstOver, stageOf,
  type Stage, type CapacityPerson, type CapacityMonthOverride, type DeliveryWeekRow,
} from "@/lib/capacityWeekly"

interface Contract {
  id: string
  name: string
  hoursPerMonth: number
  start: string
  contractedThrough: string | null
  status: string
  type: string
  accountId?: string | null
  deliveryStart?: string | null
  deliveryEnd?: string | null
}
interface Account { id: string; name: string }

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const wkLabel = (w: string) => `${MON[+w.slice(5, 7) - 1]} ${+w.slice(8, 10)}`
/** Weekly figures are prorated, so show one decimal under 10h and whole hours above. */
const fmtH = (h: number) => h >= 9.95 ? String(Math.round(h)) : String(Math.round(h * 10) / 10)

const STAGE: Record<Stage, { label: string; color: string; text: string }> = {
  committed: { label: "Signed", color: "#E9532A", text: "#1A1916" },
  qualified: { label: "Qualified", color: "#F5C4B4", text: "#92400E" },
  opportunity: { label: "Opportunity", color: "#B4C4F5", text: "#1D4ED8" },
}
const HORIZONS = [13, 26, 52] as const

// Weekly load per project vs. team capacity, looking forward from this week.
// Answers two questions: when does signed work fill the team, and when would
// the pipeline (if it closes) push past capacity — i.e. when to hire.
export default function ProjectCapacity({ contracts, accounts, deliveryMonths, deliveryWeeks, onDeliveryWeekChange, people, capacityOverrides, clientSlug }: {
  contracts: Contract[]
  accounts: Account[]
  deliveryMonths: DeliveryRow[]
  deliveryWeeks: DeliveryWeekRow[]
  onDeliveryWeekChange: (contractId: string, week: string, hours: number | null) => void
  people: CapacityPerson[]
  capacityOverrides: CapacityMonthOverride[]
  clientSlug?: string
}) {
  const [horizon, setHorizon] = useState<(typeof HORIZONS)[number]>(26)
  const [withContractors, setWithContractors] = useState(false)
  const [withOpps, setWithOpps] = useState(false)

  const thisWeek = currentWeek()
  const weeks = useMemo(() => weeksFrom(thisWeek, horizon), [thisWeek, horizon])

  const [saveError, setSaveError] = useState<string | null>(null)
  // The one cell being typed into; Tab / Shift+Tab walk it along the row.
  const [active, setActive] = useState<{ contractId: string; i: number } | null>(null)

  // Every live project gets a row — even one with no planned hours yet — so its
  // weeks can be filled in by hand. Ended projects only show if they still have hours here.
  const rows = useMemo(() => contracts
    .map(c => ({ c, stage: stageOf(c.status), ...projectHoursByWeek(c, deliveryMonths, deliveryWeeks, weeks) }))
    .filter((r): r is typeof r & { stage: Stage } => {
      if (r.stage === null) return false
      if (r.hours.some(h => h > 0.05) || r.edited.some(Boolean)) return true
      const end = r.c.type === "oneoff" ? (r.c.deliveryEnd || r.c.deliveryStart || r.c.start) : r.c.contractedThrough
      return !end || end >= weeks[0].slice(0, 7)
    }),
  [contracts, deliveryMonths, deliveryWeeks, weeks])

  async function saveWeek(contractId: string, week: string, hours: number | null, previous: number | null) {
    setSaveError(null)
    onDeliveryWeekChange(contractId, week, hours)
    const res = await fetch(`/api/contracts/${contractId}/delivery-weeks`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ week, hours }),
    }).catch(() => null)
    if (!res?.ok) {
      onDeliveryWeekChange(contractId, week, previous)
      setSaveError(`Couldn't save hours for the week of ${wkLabel(week)} — try again.`)
    }
  }

  const capacity = useMemo(() => teamCapacityByWeek(people, capacityOverrides, weeks, withContractors),
    [people, capacityOverrides, weeks, withContractors])

  const sumStage = (st: Stage) => weeks.map((_, i) => rows.filter(r => r.stage === st).reduce((s, r) => s + r.hours[i], 0))
  const signed = sumStage("committed")
  const qualified = sumStage("qualified")
  const opps = sumStage("opportunity")
  // "If the pipeline closes" — qualified always; opportunities only when asked.
  const forecast = weeks.map((_, i) => signed[i] + qualified[i] + (withOpps ? opps[i] : 0))

  const signedOverAt = firstOver(signed, capacity)
  const forecastOverAt = firstOver(forecast, capacity)
  const peakShort = Math.max(0, ...forecast.map((h, i) => h - capacity[i]))
  const fte = fteWeeklyHours(people)
  const minHeadroom = Math.min(...forecast.map((h, i) => capacity[i] - h))
  const util0 = capacity[0] > 0 ? Math.round((signed[0] / capacity[0]) * 100) : null

  const hasTeam = capacity.some(c => c > 0)
  const accountName = (id?: string | null) => id ? accounts.find(a => a.id === id)?.name : null

  const card: React.CSSProperties = { flex: "1 1 200px", background: "#FBFAF7", border: "1px solid #ECE7DE", borderRadius: 10, padding: "12px 14px" }
  const cardLabel: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: "#9C9590", textTransform: "uppercase", letterSpacing: "0.04em" }
  const cardValue: React.CSSProperties = { fontSize: 20, fontWeight: 700, color: "#1A1916", marginTop: 4, fontVariantNumeric: "tabular-nums" }
  const cardSub: React.CSSProperties = { fontSize: 11, color: "#9C9590", marginTop: 2 }

  return (
    <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h3 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 20, fontWeight: 600, color: "#1A1916", margin: 0 }}>Capacity by Week</h3>
          <div style={{ fontSize: 12, color: "#9C9590", marginTop: 2, maxWidth: 560 }}>
            Planned delivery hours per project each week (Sun–Sat) against what the team can deliver. Monthly hours are spread evenly across the days of the month; capacity follows each person&apos;s start and end dates.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontSize: 12, color: "#6B6560" }}>
          <div style={{ display: "flex", gap: 2, background: "#F5F1EC", borderRadius: 6, padding: 2 }}>
            {HORIZONS.map(h => (
              <button key={h} onClick={() => setHorizon(h)}
                style={{ padding: "3px 10px", fontSize: 11, fontWeight: 600, border: "none", borderRadius: 4, cursor: "pointer", background: horizon === h ? "#fff" : "transparent", color: horizon === h ? "#1A1916" : "#9C9590", boxShadow: horizon === h ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
                {h} wks
              </button>
            ))}
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
            <input type="checkbox" checked={withOpps} onChange={e => setWithOpps(e.target.checked)} /> Count opportunities
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
            <input type="checkbox" checked={withContractors} onChange={e => setWithContractors(e.target.checked)} /> Include contractors
          </label>
        </div>
      </div>

      {!hasTeam ? (
        <div style={{ marginTop: 16, fontSize: 13, color: "#9C9590" }}>
          No team capacity yet — add people with billable hours on the Team tab{withContractors ? "" : " (or include contractors)"} to see when you&apos;ll be full.
        </div>
      ) : (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
          <div style={card}>
            <div style={cardLabel}>This week</div>
            <div style={cardValue}>{fmtH(signed[0])}h <span style={{ fontSize: 13, color: "#9C9590", fontWeight: 500 }}>/ {fmtH(capacity[0])}h</span></div>
            <div style={{ ...cardSub, color: util0 !== null && util0 > 100 ? "#C2410C" : util0 !== null && util0 >= 85 ? "#B45309" : "#1F7A4D", fontWeight: 600 }}>
              {util0 !== null ? `${util0}% utilized by signed work` : "No capacity this week"}
            </div>
          </div>
          <div style={card}>
            <div style={cardLabel}>Signed work hits capacity</div>
            <div style={{ ...cardValue, color: signedOverAt === 0 ? "#C2410C" : "#1A1916" }}>
              {signedOverAt === -1 ? "Not yet" : signedOverAt === 0 ? "Already over" : `Week of ${wkLabel(weeks[signedOverAt])}`}
            </div>
            <div style={cardSub}>{signedOverAt === -1 ? `Within the next ${horizon} weeks` : `${fmtH(signed[signedOverAt] - capacity[signedOverAt])}h over that week`}</div>
          </div>
          <div style={{ ...card, background: forecastOverAt === -1 ? "#F0FAF4" : "#FFF7ED", borderColor: forecastOverAt === -1 ? "#CDEBD9" : "#F5D9B8" }}>
            <div style={cardLabel}>If the pipeline closes</div>
            {forecastOverAt === -1 ? (
              <>
                <div style={{ ...cardValue, color: "#1F7A4D" }}>Room for ~{fmtH(Math.max(0, minHeadroom))}h/wk</div>
                <div style={cardSub}>Tightest week still under capacity — no hire needed yet</div>
              </>
            ) : (
              <>
                <div style={{ ...cardValue, color: "#B45309" }}>Hire by {wkLabel(weeks[forecastOverAt])}</div>
                <div style={cardSub}>
                  Short up to {fmtH(peakShort)}h/wk ≈ {Math.round((peakShort / fte) * 10) / 10} FTE
                  {forecastOverAt < 6 && <> · <strong style={{ color: "#C2410C" }}>under 6 weeks away</strong></>}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {hasTeam && (
        <LoadChart weeks={weeks} signed={signed} qualified={qualified} opps={withOpps ? opps : null} capacity={capacity} />
      )}

      {rows.length === 0 ? (
        <div style={{ marginTop: 16, fontSize: 13, color: "#9C9590" }}>No active or pipeline projects with hours in this window. Set hours/month on a project to see it here.</div>
      ) : (
        <div style={{ overflowX: "auto", marginTop: 16, border: "1px solid #F0ECE5", borderRadius: 8 }}>
          <table style={{ borderCollapse: "separate", borderSpacing: 0, fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
            <thead>
              <tr>
                <th style={{ ...stickyTh, zIndex: 3 }}>Project</th>
                {weeks.map((w, i) => {
                  const newMonth = i === 0 || w.slice(5, 7) !== weeks[i - 1].slice(5, 7)
                  return (
                    <th key={w} style={{ ...weekTh, borderLeft: newMonth && i > 0 ? "1px solid #E5E0D8" : undefined, background: i === 0 ? "#FDF6F1" : "#FBFAF7" }}>
                      <div style={{ color: newMonth ? "#6B6560" : "transparent", fontSize: 9 }}>{MON[+w.slice(5, 7) - 1]}</div>
                      {+w.slice(8, 10)}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {(["committed", "qualified", "opportunity"] as const).map(st => {
                const group = rows.filter(r => r.stage === st)
                if (!group.length) return null
                return [
                  <tr key={`h-${st}`}>
                    <td colSpan={weeks.length + 1} style={{ padding: "8px 10px 4px", fontSize: 10, fontWeight: 700, color: STAGE[st].text, textTransform: "uppercase", letterSpacing: "0.04em", background: "#fff" }}>
                      <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: STAGE[st].color, marginRight: 6 }} />
                      {STAGE[st].label}
                    </td>
                  </tr>,
                  ...group.map(({ c, hours, edited, planned }) => {
                    const acct = accountName(c.accountId)
                    const peak = Math.max(...hours, 1)
                    return (
                      <tr key={c.id}>
                        <td style={stickyTd} title={acct ? `${c.name} — ${acct}` : c.name}>
                          {clientSlug
                            ? <Link href={`/clients/${clientSlug}/projects/${c.id}`} style={{ color: "#1A1916", textDecoration: "none", fontWeight: 600 }}>{c.name}</Link>
                            : <span style={{ fontWeight: 600 }}>{c.name}</span>}
                          {acct && <div style={{ fontSize: 10, color: "#9C9590", overflow: "hidden", textOverflow: "ellipsis" }}>{acct}</div>}
                        </td>
                        {hours.map((h, i) => (
                          <WeekCell key={weeks[i]} hours={h} edited={edited[i]} planned={planned[i]}
                            color={STAGE[st].text} fill={h > 0.05 ? tint(STAGE[st].color, 0.12 + 0.28 * (h / peak)) : undefined}
                            italic={st !== "committed"}
                            editing={active?.contractId === c.id && active.i === i}
                            onStart={() => setActive({ contractId: c.id, i })}
                            onDone={move => setActive(cur => {
                              if (cur?.contractId !== c.id || cur.i !== i) return cur // focus already moved elsewhere
                              const next = i + move
                              return move !== 0 && next >= 0 && next < weeks.length ? { contractId: c.id, i: next } : null
                            })}
                            onSave={v => saveWeek(c.id, weeks[i], v, edited[i] ? h : null)} />
                        ))}
                      </tr>
                    )
                  }),
                ]
              })}

              <TotalRow label="Signed" values={signed} strong topBorder />
              {qualified.some(h => h > 0.05) && <TotalRow label="+ Qualified" values={qualified} muted />}
              {opps.some(h => h > 0.05) && <TotalRow label={withOpps ? "+ Opportunities" : "Opportunities (not counted)"} values={opps} muted />}
              <TotalRow label={`Team capacity${withContractors ? "" : " (in-house)"}`} values={capacity} />
              <tr>
                <td style={{ ...stickyTd, fontWeight: 700 }}>Headroom</td>
                {forecast.map((h, i) => {
                  const room = capacity[i] - h
                  return (
                    <td key={i} style={{ ...cellTd, fontWeight: 700, color: room < -0.05 ? "#C2410C" : room < capacity[i] * 0.15 ? "#B45309" : "#1F7A4D", background: room < -0.05 ? "#FEF2F2" : undefined }}>
                      {room < -0.05 ? `−${fmtH(-room)}` : fmtH(room)}
                    </td>
                  )
                })}
              </tr>
              <tr>
                <td style={{ ...stickyTd, color: "#9C9590" }}>Utilization</td>
                {forecast.map((h, i) => {
                  const u = capacity[i] > 0 ? Math.round((h / capacity[i]) * 100) : null
                  return (
                    <td key={i} style={{ ...cellTd, color: u === null ? "#C0BAB2" : u > 100 ? "#C2410C" : u >= 85 ? "#B45309" : "#9C9590" }}>
                      {u === null ? "—" : `${u}%`}
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {saveError && <div style={{ fontSize: 12, color: "#C2410C", marginTop: 8 }}>{saveError}</div>}
      <div style={{ fontSize: 11, color: "#9C9590", marginTop: 8 }}>
        Click any project week to set its hours (Tab moves to the next week); <span style={{ borderBottom: "2px solid #1A1916" }}>underlined</span> weeks are hand-set, and clearing one returns it to the plan. Headroom and utilization count signed + qualified{withOpps ? " + opportunities" : ""} work. Project hours come from each project&apos;s hours/month (one-offs use their delivery months); capacity from billable hours on the Team tab, including any month-by-month overrides.
      </div>
    </div>
  )
}

/** One project-week. Click to type hours; Enter/blur saves, Tab/Shift+Tab save and move along the row, Esc cancels, empty resets to the plan. */
function WeekCell({ hours, edited, planned, color, fill, italic, editing, onStart, onDone, onSave }: {
  hours: number; edited: boolean; planned: number; color: string; fill?: string; italic: boolean
  editing: boolean
  onStart: () => void
  /** Finished editing; `move` is -1/+1 to open the neighbouring week, 0 to stop. */
  onDone: (move: -1 | 0 | 1) => void
  onSave: (hours: number | null) => void
}) {
  const has = hours > 0.05
  if (editing) {
    return (
      <td style={{ ...cellTd, padding: 2 }}>
        <WeekInput initial={has || edited ? fmtH(hours) : ""} onDone={(draft, move) => {
          const t = draft.trim()
          if (t === "") { if (edited) onSave(null) }
          else {
            const v = Number(t)
            if (Number.isFinite(v) && v >= 0 && v <= 168) {
              const r = Math.round(v * 100) / 100
              if (edited ? r !== hours : Math.abs(r - planned) > 0.05) onSave(r)
            }
          }
          onDone(move)
        }} onCancel={() => onDone(0)} />
      </td>
    )
  }
  return (
    <td onClick={onStart}
      title={edited ? `Hand-set · plan was ${fmtH(planned)}h — clear to reset` : "Click to set this week's hours"}
      style={{ ...cellTd, cursor: "text", color: has ? color : "#D8D2CA", background: fill, fontStyle: italic ? "italic" : undefined, fontWeight: edited ? 700 : undefined }}>
      <span style={edited ? { borderBottom: "2px solid #1A1916", paddingBottom: 1 } : undefined}>{has ? fmtH(hours) : edited ? "0" : "·"}</span>
    </td>
  )
}

function WeekInput({ initial, onDone, onCancel }: { initial: string; onDone: (draft: string, move: -1 | 0 | 1) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState(initial)
  // Tab/Enter/Esc finish the edit themselves; the blur that follows the input
  // unmounting must not finish it a second time.
  const finished = useRef(false)
  const finish = (move: -1 | 0 | 1) => { if (finished.current) return; finished.current = true; onDone(draft, move) }
  return (
    <input autoFocus value={draft} inputMode="decimal" aria-label="Hours this week"
      onChange={e => setDraft(e.target.value)}
      onBlur={() => finish(0)}
      onKeyDown={e => {
        if (e.key === "Enter") { e.preventDefault(); finish(0) }
        else if (e.key === "Tab") { e.preventDefault(); finish(e.shiftKey ? -1 : 1) }
        else if (e.key === "Escape") { finished.current = true; onCancel() }
      }}
      onFocus={e => e.target.select()}
      style={{ width: 40, fontSize: 12, textAlign: "center", padding: "2px 2px", border: "1px solid #E9532A", borderRadius: 4, outline: "none", fontVariantNumeric: "tabular-nums" }} />
  )
}

function TotalRow({ label, values, strong, muted, topBorder }: { label: string; values: number[]; strong?: boolean; muted?: boolean; topBorder?: boolean }) {
  const border = topBorder ? "2px solid #ECE7DE" : undefined
  return (
    <tr>
      <td style={{ ...stickyTd, fontWeight: strong ? 700 : 500, color: muted ? "#9C9590" : "#1A1916", borderTop: border }}>{label}</td>
      {values.map((h, i) => (
        <td key={i} style={{ ...cellTd, fontWeight: strong ? 700 : 500, color: muted ? "#9C9590" : "#1A1916", borderTop: border }}>{h > 0.05 ? fmtH(h) : "—"}</td>
      ))}
    </tr>
  )
}

/** Stacked weekly load (signed / qualified / opportunities) with the capacity line stepped over it. */
function LoadChart({ weeks, signed, qualified, opps, capacity }: { weeks: string[]; signed: number[]; qualified: number[]; opps: number[] | null; capacity: number[] }) {
  const W = 800, H = 150, PAD_L = 34, PAD_B = 16, PAD_T = 8
  const totals = weeks.map((_, i) => signed[i] + qualified[i] + (opps?.[i] ?? 0))
  const max = Math.max(...totals, ...capacity, 1) * 1.08
  const plotW = W - PAD_L, plotH = H - PAD_B - PAD_T
  const bw = plotW / weeks.length
  const y = (h: number) => PAD_T + plotH - (h / max) * plotH
  const ticks = [0, max / 2, max].map(v => Math.round(v / 5) * 5)
  const capPath = capacity.map((c, i) => `${i === 0 ? "M" : "L"}${PAD_L + i * bw},${y(c)} L${PAD_L + (i + 1) * bw},${y(c)}`).join(" ")
  const labelEvery = weeks.length <= 13 ? 1 : weeks.length <= 26 ? 2 : 4

  return (
    <div style={{ marginTop: 16 }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Weekly load vs. capacity">
        {ticks.map(t => (
          <g key={t}>
            <line x1={PAD_L} x2={W} y1={y(t)} y2={y(t)} stroke="#F0ECE5" />
            <text x={PAD_L - 4} y={y(t) + 3} fontSize={9} fill="#B0A9A0" textAnchor="end">{t}h</text>
          </g>
        ))}
        {weeks.map((w, i) => {
          const x = PAD_L + i * bw + bw * 0.15, bwi = bw * 0.7
          const layers: [number, string][] = [[signed[i], "#E9532A"], [qualified[i], "#F5C4B4"], ...(opps ? [[opps[i], "#B4C4F5"] as [number, string]] : [])]
          let base = 0
          const over = totals[i] > capacity[i] + 0.05
          return (
            <g key={w}>
              <title>{`Week of ${wkLabel(w)}: ${fmtH(signed[i])}h signed, ${fmtH(qualified[i])}h qualified${opps ? `, ${fmtH(opps[i])}h opportunities` : ""} · capacity ${fmtH(capacity[i])}h`}</title>
              {layers.map(([h, color], li) => {
                const rect = <rect key={li} x={x} width={bwi} y={y(base + h)} height={Math.max(0, y(base) - y(base + h))} fill={color} opacity={li === 0 ? 0.9 : 0.85} />
                base += h
                return rect
              })}
              {over && <rect x={x} width={bwi} y={y(totals[i])} height={Math.max(0, y(capacity[i]) - y(totals[i]))} fill="none" stroke="#C2410C" strokeWidth={1} strokeDasharray="2 2" />}
              {i % labelEvery === 0 && <text x={x + bwi / 2} y={H - 3} fontSize={9} fill="#B0A9A0" textAnchor="middle">{wkLabel(w)}</text>}
            </g>
          )
        })}
        <path d={capPath} fill="none" stroke="#1A1916" strokeWidth={1.5} />
      </svg>
      <div style={{ display: "flex", gap: 14, fontSize: 11, color: "#9C9590", flexWrap: "wrap", marginTop: 4 }}>
        <Swatch color="#E9532A" label="Signed" />
        <Swatch color="#F5C4B4" label="Qualified" />
        {opps && <Swatch color="#B4C4F5" label="Opportunities" />}
        <span><span style={{ display: "inline-block", width: 14, height: 2, background: "#1A1916", verticalAlign: "middle", marginRight: 4 }} />Team capacity</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, border: "1px dashed #C2410C", verticalAlign: "middle", marginRight: 4 }} />Over capacity</span>
      </div>
    </div>
  )
}

function Swatch({ color, label }: { color: string; label: string }) {
  return <span><span style={{ display: "inline-block", width: 10, height: 10, background: color, borderRadius: 2, verticalAlign: "middle", marginRight: 4 }} />{label}</span>
}

/** A hex colour at the given alpha, for heat-shading cells. */
function tint(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a.toFixed(2)})`
}

const stickyTh: React.CSSProperties = { position: "sticky", left: 0, background: "#FBFAF7", textAlign: "left", padding: "6px 10px", fontSize: 10, fontWeight: 700, color: "#9C9590", textTransform: "uppercase", letterSpacing: "0.04em", minWidth: 180, maxWidth: 220, borderBottom: "1px solid #ECE7DE", borderRight: "1px solid #ECE7DE" }
const weekTh: React.CSSProperties = { padding: "4px 4px 6px", fontSize: 11, fontWeight: 600, color: "#1A1916", textAlign: "center", minWidth: 40, borderBottom: "1px solid #ECE7DE", lineHeight: 1.2 }
const stickyTd: React.CSSProperties = { position: "sticky", left: 0, zIndex: 1, background: "#fff", padding: "5px 10px", minWidth: 180, maxWidth: 220, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", borderRight: "1px solid #ECE7DE", borderBottom: "1px solid #F5F1EC", color: "#1A1916" }
const cellTd: React.CSSProperties = { padding: "5px 4px", textAlign: "center", minWidth: 40, borderBottom: "1px solid #F5F1EC", whiteSpace: "nowrap" }
