"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useFmtCurrency, useCurrency } from "@/lib/CurrencyContext"

const accent = "#E9532A"

interface Row { month: string; amount: string; hours: string }

interface Props {
  contractId: string
  projectName: string
  mode?: "oneoff" | "retainer"
  total: number       // one-off: the full fee. retainer: the monthly amount.
  hoursPerMonth?: number   // seeds each active month's hours
  startMonth: string  // YYYY-MM, used to seed default months
  endMonth?: string | null  // retainer: contractedThrough, bounds the seeded term
  deliveryStart?: string | null  // one-off: work window, seeds hour rows
  deliveryEnd?: string | null
  onClose: () => void
}

function ymAdd(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number)
  if (!y || !m) return ym
  const t = y * 12 + (m - 1) + n
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`
}
function ymDiff(a: string, b: string): number {
  const [ay, am] = a.split("-").map(Number)
  const [by, bm] = b.split("-").map(Number)
  if (!ay || !am || !by || !bm) return 0
  return (by * 12 + bm) - (ay * 12 + am)
}
const num = (s: string) => { const n = parseFloat(s); return isNaN(n) ? 0 : n }
const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi)
const r1 = (n: number) => Math.round(n * 10) / 10

export default function PaymentScheduleModal({ contractId, projectName, mode = "oneoff", total, hoursPerMonth = 0, startMonth, endMonth, deliveryStart, deliveryEnd, onClose }: Props) {
  const isRetainer = mode === "retainer"
  const router = useRouter()
  const fmt$ = useFmtCurrency()
  const cur = useCurrency()
  const sym = cur === "GBP" ? "£" : cur === "EUR" ? "€" : "$"
  const [rows, setRows] = useState<Row[]>([])
  const [existingPay, setExistingPay] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    Promise.all([
      fetch(`/api/contracts/${contractId}/payments`).then(r => r.ok ? r.json() : []),
      fetch(`/api/contracts/${contractId}/delivery`).then(r => r.ok ? r.json() : []),
    ]).then(([pays, deliv]: [{ month: string; amount: number }[], { month: string; hours: number }[]]) => {
      if (!active) return
      const payMap = new Map(pays.map(p => [p.month, p.amount]))
      const delivMap = new Map(deliv.map(d => [d.month, d.hours]))
      setExistingPay(pays.map(p => p.month))

      // Build the union of months from payments, the term/window, and delivery rows.
      let months: string[] = []
      if (pays.length) months = pays.map(p => p.month)
      else if (isRetainer && startMonth) {
        const span = endMonth ? clamp(ymDiff(startMonth, endMonth) + 1, 1, 36) : 12
        months = Array.from({ length: span }, (_, i) => ymAdd(startMonth, i))
      } else if (startMonth) months = [startMonth]

      const dStart = deliveryStart || (mode === "oneoff" ? startMonth : "")
      const dEnd = deliveryEnd || dStart
      if (dStart) {
        const dspan = clamp(ymDiff(dStart, dEnd) + 1, 1, 36)
        for (let i = 0; i < dspan; i++) { const m = ymAdd(dStart, i); if (!months.includes(m)) months.push(m) }
      }
      for (const m of delivMap.keys()) if (!months.includes(m)) months.push(m)
      months = months.filter(m => /^\d{4}-\d{2}$/.test(m)).sort()
      if (!months.length && startMonth) months = [startMonth]

      setRows(months.map(m => ({
        month: m,
        amount: payMap.has(m)
          ? String(payMap.get(m))
          : (!pays.length && (isRetainer ? true : m === startMonth) ? String(Math.round(total)) : "0"),
        hours: delivMap.has(m)
          ? String(delivMap.get(m))
          : ((isRetainer || (dStart && m >= dStart && m <= dEnd)) && hoursPerMonth ? String(hoursPerMonth) : ""),
      })))
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [contractId, startMonth, endMonth, total, isRetainer, mode, hoursPerMonth, deliveryStart, deliveryEnd])

  const scheduled = rows.reduce((s, r) => s + num(r.amount), 0)
  const totalHours = rows.reduce((s, r) => s + num(r.hours), 0)
  const base = startMonth || rows[0]?.month || new Date().toISOString().slice(0, 7)

  function setRow(i: number, patch: Partial<Row>) { setRows(rs => rs.map((r, j) => j === i ? { ...r, ...patch } : r)) }
  function addRow() { setRows(rs => [...rs, { month: ymAdd(rs[rs.length - 1]?.month || base, 1), amount: "0", hours: isRetainer ? String(hoursPerMonth || 0) : "" }]) }
  function removeRow(i: number) { setRows(rs => rs.filter((_, j) => j !== i)) }

  // Payment quick-fills — a starting point; every row stays editable.
  function fillEven() {
    const n = rows.length || 1
    const each = Math.round(total / n)
    setRows(rs => rs.map((r, i) => ({ ...r, month: r.month || ymAdd(base, i), amount: String(i === n - 1 ? total - each * (n - 1) : each) })))
  }
  function fill403030(pcts: number[]) {
    setRows(rs => pcts.map((p, i) => ({ month: ymAdd(base, i), amount: String(Math.round(total * p / 100)), hours: rs[i]?.hours ?? "" })))
  }
  function fillSame() { setRows(rs => rs.map(r => ({ ...r, amount: String(Math.round(total)) }))) }
  function shiftMonths(n: number) { setRows(rs => rs.map(r => ({ ...r, month: r.month ? ymAdd(r.month, n) : r.month }))) }
  // Hours quick-fills.
  function fillHoursSame() { setRows(rs => rs.map(r => ({ ...r, hours: String(hoursPerMonth || 0) }))) }
  function splitHoursEven() {
    const n = rows.length || 1
    const each = r1(totalHours / n) || 0
    if (!each) return
    setRows(rs => rs.map((r, i) => ({ ...r, hours: String(i === n - 1 ? r1(totalHours - each * (n - 1)) : each) })))
  }

  async function save() {
    setSaving(true)
    try {
      const valid = rows.filter(r => /^\d{4}-\d{2}$/.test(r.month))
      const payRows = valid.filter(r => num(r.amount) > 0)
      for (const r of payRows) {
        await fetch(`/api/contracts/${contractId}/payments`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ month: r.month, amount: num(r.amount) }),
        })
      }
      const keep = new Set(payRows.map(r => r.month))
      for (const m of existingPay) {
        if (!keep.has(m)) await fetch(`/api/contracts/${contractId}/payments?month=${m}`, { method: "DELETE" })
      }
      await fetch(`/api/contracts/${contractId}/delivery`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ months: valid.map(r => ({ month: r.month, hours: num(r.hours) })) }),
      })
      router.refresh()
      onClose()
    } finally { setSaving(false) }
  }

  const inputStyle: React.CSSProperties = { padding: "7px 10px", border: "1px solid #ECE7DE", borderRadius: 7, fontSize: 13, background: "#fff", color: "#1A1916", fontFamily: "inherit", outline: "none" }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(26,25,22,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 1000 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 24, width: "min(600px, 100%)", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 12px 48px rgba(0,0,0,0.24)" }}>
        <div style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 22, fontWeight: 600, color: "#1A1916" }}>Payment &amp; hours schedule</div>
        <div style={{ fontSize: 13, color: "#9C9590", marginBottom: 16 }}>{projectName} · {isRetainer ? `${fmt$(total)}/mo` : `total ${fmt$(total)}`} · payment is cash, hours are delivery</div>

        {loading ? <div style={{ fontSize: 13, color: "#9C9590" }}>Loading…</div> : (
          <>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
              {isRetainer ? (
                <>
                  <button onClick={fillSame} style={chip}>Same $ each</button>
                  <button onClick={() => shiftMonths(1)} style={chip}>Shift +1</button>
                  <button onClick={() => shiftMonths(-1)} style={chip}>Shift −1</button>
                  {hoursPerMonth > 0 && <button onClick={fillHoursSame} style={chip}>Hrs = {r1(hoursPerMonth)}/mo</button>}
                </>
              ) : (
                <>
                  <button onClick={fillEven} style={chip}>Split $ evenly</button>
                  <button onClick={() => fill403030([40, 40, 20])} style={chip}>40 / 40 / 20</button>
                  <button onClick={() => fill403030([50, 50])} style={chip}>50 / 50</button>
                  {totalHours > 0 && <button onClick={splitHoursEven} style={chip}>Split hrs evenly</button>}
                </>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "auto 1.1fr 1fr 0.8fr auto", gap: 8, alignItems: "center", marginBottom: 10 }}>
              <div style={hdr}>#</div><div style={hdr}>Month</div><div style={hdr}>Payment {sym}</div><div style={hdr}>Hours</div><div />
              {rows.map((r, i) => (
                <div key={i} style={{ display: "contents" }}>
                  <div style={{ fontSize: 12, color: "#9C9590", textAlign: "center" }}>{i + 1}</div>
                  <input style={inputStyle} type="month" value={r.month} onChange={e => setRow(i, { month: e.target.value })} />
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input style={{ ...inputStyle, flex: 1, width: "100%" }} type="number" min={0} value={r.amount} onChange={e => setRow(i, { amount: e.target.value })} />
                    {!isRetainer && total > 0 && <span style={{ fontSize: 11, color: "#9C9590", minWidth: 34, textAlign: "right" }}>{Math.round(num(r.amount) / total * 100)}%</span>}
                  </div>
                  <input style={{ ...inputStyle, width: "100%" }} type="number" min={0} step="any" value={r.hours} placeholder="0" onChange={e => setRow(i, { hours: e.target.value })} />
                  <button onClick={() => removeRow(i)} title="Remove" style={{ background: "none", border: "none", color: "#C4BFBA", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
                </div>
              ))}
            </div>

            <button onClick={addRow} style={{ ...chip, marginBottom: 14 }}>+ Add month</button>

            <div style={{ display: "flex", gap: 20, marginBottom: 16, flexWrap: "wrap" }}>
              {isRetainer ? (
                <div style={{ fontSize: 13, color: "#6B6760" }}>
                  Payments: <strong style={{ color: "#1A1916" }}>{fmt$(scheduled)}</strong> across {rows.filter(r => /^\d{4}-\d{2}$/.test(r.month) && num(r.amount) > 0).length} mo
                </div>
              ) : (
                <div style={{ fontSize: 13, color: scheduled === Math.round(total) ? "#1F7A4D" : "#C2410C" }}>
                  Payments: <strong>{fmt$(scheduled)}</strong> of {fmt$(total)}
                  {scheduled !== Math.round(total) && <> · {scheduled > total ? "over" : "under"} by {fmt$(Math.abs(total - scheduled))}</>}
                </div>
              )}
              <div style={{ fontSize: 13, color: "#6B6760" }}>
                Hours: <strong style={{ color: "#1A1916" }}>{r1(totalHours)}h</strong> across {rows.filter(r => /^\d{4}-\d{2}$/.test(r.month) && num(r.hours) > 0).length} mo
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={onClose} style={{ ...chip, border: "1px solid #E0DAD0" }}>Cancel</button>
              <button onClick={save} disabled={saving} style={{ fontSize: 13, fontWeight: 600, color: "#fff", background: accent, border: "none", borderRadius: 8, padding: "9px 20px", cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}>
                {saving ? "Saving…" : "Save schedule"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const chip: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "#6B6760", background: "#fff", border: "1px solid #ECE7DE", borderRadius: 7, padding: "6px 12px", cursor: "pointer" }
const hdr: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "#9C9590" }
