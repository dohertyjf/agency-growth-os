"use client"
import { useState } from "react"
import { ymAdd, ymLabel } from "@/lib/calc"
import { useFmtCurrency } from "@/lib/CurrencyContext"

interface Contract {
  id: string
  monthly: number
  start: string
  contractedThrough: string | null
  status: string
  type: string
}

// Confidence bands, top of the stack (least certain) first.
const CONTRACTED = "#E9532A"
const QUALIFIED = "#F3A088"
const OPPORTUNITY = "#F9D2C5"

const now = new Date().toISOString().slice(0, 7)

function activeInMonth(c: Contract, ym: string) {
  return c.start <= ym && (c.contractedThrough === null || c.contractedThrough >= ym)
}

export default function CashflowProjection({ contracts }: { contracts: Contract[] }) {
  const fmt$ = useFmtCurrency()
  const [horizon, setHorizon] = useState<"6" | "12" | "eoy">("eoy")

  const months: string[] = (() => {
    if (horizon === "eoy") {
      const end = `${now.slice(0, 4)}-12`
      const out: string[] = []
      let m = now
      while (m <= end) { out.push(m); m = ymAdd(m, 1) }
      return out.length ? out : [now]
    }
    const n = horizon === "6" ? 6 : 12
    return Array.from({ length: n }, (_, i) => ymAdd(now, i))
  })()

  const bandSum = (statusKey: string, ym: string) =>
    contracts
      .filter(c => c.status === statusKey && activeInMonth(c, ym))
      .reduce((s, c) => s + c.monthly, 0)

  const monthData = months.map(ym => {
    const active = bandSum("active", ym)
    const qualified = bandSum("potential", ym)
    const opportunity = bandSum("opportunity", ym)
    return { ym, active, qualified, opportunity, total: active + qualified + opportunity }
  })

  const maxTotal = Math.max(1, ...monthData.map(d => d.total))
  const CHART_H = 168

  const sum = (sel: (d: (typeof monthData)[number]) => number) => monthData.reduce((s, d) => s + sel(d), 0)
  const floor = sum(d => d.active)
  const withQualified = floor + sum(d => d.qualified)
  const ceiling = withQualified + sum(d => d.opportunity)
  const hasAny = ceiling > 0

  const totals = [
    { label: "Contracted", val: floor, color: "#E9532A", sub: "signed floor" },
    { label: "+ Qualified", val: withQualified, color: "#C2410C", sub: "probable" },
    { label: "+ Opportunity", val: ceiling, color: "#6B6760", sub: "all-in ceiling" },
  ]

  return (
    <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1916" }}>Cash-flow projection</div>
          <div style={{ fontSize: 11, color: "#9C9590", marginTop: 2 }}>Stacked by confidence · least certain on top</div>
        </div>
        <div style={{ display: "flex", gap: 2, background: "#F5F1EC", borderRadius: 6, padding: 2 }}>
          {([["6", "6 mo"], ["12", "12 mo"], ["eoy", "To year-end"]] as const).map(([v, label]) => (
            <button key={v} onClick={() => setHorizon(v)}
              style={{ padding: "3px 10px", fontSize: 11, fontWeight: 600, border: "none", borderRadius: 4, cursor: "pointer", background: horizon === v ? "#fff" : "transparent", color: horizon === v ? "#1A1916" : "#9C9590", boxShadow: horizon === v ? "0 1px 3px rgba(0,0,0,0.08)" : "none", whiteSpace: "nowrap" }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {!hasAny ? (
        <div style={{ fontSize: 13, color: "#9C9590", padding: "24px 0", lineHeight: 1.5 }}>
          No active, qualified, or opportunity projects in this window. Add a project on the <strong>Projects</strong> tab (status <strong>Qualified</strong> or <strong>Opportunity</strong>) to model future revenue.
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, margin: "16px 0 20px" }}>
            {totals.map(t => (
              <div key={t.label} style={{ border: "1px solid #ECE7DE", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#9C9590" }}>{t.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: t.color, fontVariantNumeric: "tabular-nums", marginTop: 4 }}>{fmt$(t.val)}</div>
                <div style={{ fontSize: 11, color: "#B0A9A0", marginTop: 2 }}>{t.sub} · {months.length} mo</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: CHART_H, borderBottom: "1px solid #ECE7DE" }}>
            {monthData.map(d => (
              <div key={d.ym} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", height: "100%", minWidth: 0 }}>
                <div title={`${ymLabel(d.ym)} · ${fmt$(d.total)}`} style={{ width: "100%", maxWidth: 46, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
                  <div style={{ height: (d.opportunity / maxTotal) * CHART_H, background: OPPORTUNITY }} />
                  <div style={{ height: (d.qualified / maxTotal) * CHART_H, background: QUALIFIED }} />
                  <div style={{ height: (d.active / maxTotal) * CHART_H, background: CONTRACTED }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            {monthData.map(d => (
              <div key={d.ym} style={{ flex: 1, textAlign: "center", fontSize: 9, color: d.ym === now ? "#E9532A" : "#B0A9A0", fontWeight: d.ym === now ? 700 : 400, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden" }}>{ymLabel(d.ym)}</div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 16, marginTop: 14, flexWrap: "wrap" }}>
            {[{ c: CONTRACTED, l: "Contracted" }, { c: QUALIFIED, l: "Qualified" }, { c: OPPORTUNITY, l: "Opportunity" }].map(x => (
              <div key={x.l} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#6B6760" }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: x.c, display: "inline-block" }} />
                {x.l}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "#9C9590", marginTop: 14, lineHeight: 1.5 }}>
            To model a client&apos;s future (e.g. a one-off that might continue), add a project on the <strong>Projects</strong> tab at the confidence you expect — <strong>Qualified</strong> or <strong>Opportunity</strong> — with its months and amount. It flows in here automatically.
          </div>
        </>
      )}
    </div>
  )
}
