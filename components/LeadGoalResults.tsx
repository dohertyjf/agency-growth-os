"use client"
import { fmtCurrency, type LeadsGoalResult } from "@/lib/calc"

const accent = "#E9532A"

interface Props {
  r: LeadsGoalResult
  goalRevenue: number
  currentLeads: number | null
  months: number
  setMonths: (n: number) => void
  currency: string
}

export default function LeadGoalResults({ r, goalRevenue, currentLeads, months, setMonths, currency }: Props) {
  const fmt$ = (v: number) => fmtCurrency(v, currency)
  const needed = Math.ceil(r.leadsToReachGoal)
  const treadmill = Math.round(r.leadsToHoldCurrent)

  if (!r.valid) {
    return (
      <div style={{ background: "#FBF0EB", border: "1px solid #F0C3B0", borderRadius: 12, padding: 20, fontSize: 14, color: "#9A3412" }}>
        Enter a close rate and an average deal size to calculate.
      </div>
    )
  }

  return (
    <>
      {/* Timeframe slider */}
      <div className="no-print" style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: "16px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: "#1A1916", whiteSpace: "nowrap" }}>Reach it in</label>
        <input type="range" min={3} max={24} step={1} value={months} onChange={e => setMonths(parseInt(e.target.value))}
          style={{ flex: 1, minWidth: 160, accentColor: accent }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: accent, minWidth: 78, textAlign: "right" }}>{months} months</span>
      </div>

      {/* Headline */}
      <div style={{ background: "#1A1916", borderRadius: 14, padding: "26px 24px", color: "#fff", marginBottom: 16 }}>
        {r.goalBelowCurrent ? (
          <div style={{ fontSize: 18, lineHeight: 1.4 }}>
            You&apos;re already past {fmt$(goalRevenue)}/mo. To <strong>hold</strong> it, you need{" "}
            <span style={{ color: "#F4A47F", fontWeight: 800, fontSize: 22 }}>{Math.ceil(r.leadsToHoldGoal)} qualified leads/mo</span>.
          </div>
        ) : (
          <div style={{ fontSize: 18, lineHeight: 1.4 }}>
            To reach <strong>{fmt$(goalRevenue)}/mo</strong> in <strong>{months} months</strong>, you need{" "}
            <span style={{ color: "#F4A47F", fontWeight: 800, fontSize: 26 }}>{needed} qualified leads/month</span>.
          </div>
        )}
        {!r.goalBelowCurrent && (
          <>
            <div style={{ fontSize: 15, color: "#EDEAE4", marginTop: 10, lineHeight: 1.4 }}>
              That works out to about <strong style={{ color: "#fff" }}>{r.newClientsPerMonth.toFixed(1)} new clients a month</strong>.
            </div>
            {treadmill > 0 && (
              <div style={{ fontSize: 13, color: "#C9C4BC", marginTop: 8, lineHeight: 1.5 }}>
                Of those {needed} leads, about <strong style={{ color: "#fff" }}>{treadmill} just replace what rolls off</strong> — only {Math.max(0, needed - treadmill)} actually grow you.
              </div>
            )}
          </>
        )}
        {(r.goalBelowCurrent || r.alreadyEnoughLeads) && (
          <div style={{ fontSize: 14, color: "#F4A47F", marginTop: 14, paddingTop: 14, borderTop: "1px solid #3A3833", lineHeight: 1.5, fontWeight: 600 }}>
            At this point, leads is no longer your constraint. Capacity, pricing, and more become your constraint.
          </div>
        )}
      </div>

      {/* When they'll actually reach the goal at their current lead pace */}
      {currentLeads != null && currentLeads > 0 && !r.goalBelowCurrent && (() => {
        const reachN = r.monthsToReachAtCurrentLeads != null ? Math.ceil(r.monthsToReachAtCurrentLeads) : null
        if (r.reachesGoalAtCurrentLeads && reachN != null) {
          const ahead = reachN <= months
          return (
            <div style={{ background: ahead ? "#EAF3EC" : "#FBF0EB", border: `1px solid ${ahead ? "#C9E0CF" : "#F0C3B0"}`, borderRadius: 12, padding: "16px 18px", marginBottom: 16, fontSize: 15, color: "#1A1916", lineHeight: 1.5 }}>
              You&apos;re targeting <strong>{months} months</strong> — at your current <strong>{currentLeads} qualified leads/mo</strong>, you&apos;ll actually reach{" "}
              <strong>{fmt$(goalRevenue)}/mo</strong> in about{" "}
              <strong style={{ color: ahead ? "#1F7A4D" : "#C2410C" }}>{reachN} month{reachN === 1 ? "" : "s"}</strong>.
            </div>
          )
        }
        return (
          <div style={{ background: "#FBF0EB", border: "1px solid #F0C3B0", borderRadius: 12, padding: "16px 18px", marginBottom: 16, fontSize: 15, color: "#1A1916", lineHeight: 1.5 }}>
            At your current <strong>{currentLeads} qualified leads/mo</strong> you won&apos;t reach{" "}
            <strong>{fmt$(goalRevenue)}/mo</strong> — you&apos;d plateau at{" "}
            <strong style={{ color: "#C2410C" }}>{fmt$(r.ceilingAtCurrentLeads ?? 0)}/mo</strong>. You&apos;d need{" "}
            <strong>{needed} qualified leads/mo</strong> to hit it in {months} months.
          </div>
        )
      })()}

      {/* Gap + ceiling (only when current leads provided) */}
      {currentLeads != null && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 16 }}>
          <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#9C9590", marginBottom: 6 }}>The gap</div>
            {r.alreadyEnoughLeads ? (
              <div style={{ fontSize: 14, color: "#1A1916", lineHeight: 1.5 }}>
                You already generate enough leads. The constraint isn&apos;t lead volume — it&apos;s your <strong>close rate, retention, or deal size</strong>.
              </div>
            ) : (
              <div style={{ fontSize: 14, color: "#1A1916", lineHeight: 1.5 }}>
                You get <strong>{currentLeads}</strong>/mo → you&apos;re{" "}
                <strong style={{ color: accent }}>{Math.ceil(r.gap as number)} lead{Math.ceil(r.gap as number) === 1 ? "" : "s"}/mo short</strong>.
              </div>
            )}
          </div>
          <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#9C9590", marginBottom: 6 }}>Your ceiling at {currentLeads} leads/mo</div>
            {r.ceilingAtCurrentLeads == null ? (
              <div style={{ fontSize: 14, color: "#1F7A4D", lineHeight: 1.5 }}>No ceiling — with nothing rolling off, your revenue compounds.</div>
            ) : (
              <div style={{ fontSize: 14, color: "#1A1916", lineHeight: 1.5 }}>
                Revenue plateaus at <strong style={{ color: r.reachesGoalAtCurrentLeads ? "#1F7A4D" : "#C2410C" }}>{fmt$(r.ceilingAtCurrentLeads)}/mo</strong> —{" "}
                {r.reachesGoalAtCurrentLeads ? "enough for your goal." : "below your goal. More leads alone won't get you there."}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Roll-off + runway */}
      <div style={{ background: "#F5F1EC", borderRadius: 12, padding: "14px 18px", fontSize: 13, color: "#6B6760", lineHeight: 1.6 }}>
        <strong style={{ color: "#1A1916" }}>{fmt$(r.rollOff)}/mo</strong> of your revenue rolls off ({Math.round(r.churnRate * 100)}% doesn&apos;t recur).
        {r.runwayHalfLifeMonths != null && <> If you stopped selling entirely — no new leads or clients — your revenue would halve in about <strong style={{ color: "#1A1916" }}>{r.runwayHalfLifeMonths.toFixed(1)} months</strong>.</>}
      </div>
    </>
  )
}
