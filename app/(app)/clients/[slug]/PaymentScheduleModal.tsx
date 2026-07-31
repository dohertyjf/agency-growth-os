"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useFmtCurrency, useCurrency } from "@/lib/CurrencyContext"

const accent = "#E9532A"

interface Row { month: string; amount: string }

interface Props {
  contractId: string
  projectName: string
  total: number       // the project's total fee (one-off) or monthly value
  startMonth: string  // YYYY-MM, used to seed default months
  onClose: () => void
}

function ymAdd(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number)
  if (!y || !m) return ym
  const t = y * 12 + (m - 1) + n
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`
}
const num = (s: string) => { const n = parseFloat(s); return isNaN(n) ? 0 : n }

export default function PaymentScheduleModal({ contractId, projectName, total, startMonth, onClose }: Props) {
  const router = useRouter()
  const fmt$ = useFmtCurrency()
  const cur = useCurrency()
  const sym = cur === "GBP" ? "£" : cur === "EUR" ? "€" : "$"
  const [rows, setRows] = useState<Row[]>([])
  const [existing, setExisting] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    fetch(`/api/contracts/${contractId}/payments`)
      .then(r => r.ok ? r.json() : [])
      .then((pays: { month: string; amount: number }[]) => {
        if (!active) return
        if (pays.length) {
          setRows(pays.map(p => ({ month: p.month, amount: String(p.amount) })))
          setExisting(pays.map(p => p.month))
        } else {
          setRows([{ month: startMonth || "", amount: String(Math.round(total)) }])
        }
      })
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [contractId, startMonth, total])

  const scheduled = rows.reduce((s, r) => s + num(r.amount), 0)
  const base = startMonth || rows[0]?.month || new Date().toISOString().slice(0, 7)

  function setRow(i: number, patch: Partial<Row>) { setRows(rs => rs.map((r, j) => j === i ? { ...r, ...patch } : r)) }
  function addRow() { setRows(rs => [...rs, { month: ymAdd(rs[rs.length - 1]?.month || base, 1), amount: "0" }]) }
  function removeRow(i: number) { setRows(rs => rs.filter((_, j) => j !== i)) }

  // Quick-fills — a starting point; every row stays editable.
  function fillEven() {
    const n = rows.length || 1
    const each = Math.round(total / n)
    setRows(rs => rs.map((r, i) => ({ month: r.month || ymAdd(base, i), amount: String(i === n - 1 ? total - each * (n - 1) : each) })))
  }
  function fill403030(pcts: number[]) {
    setRows(pcts.map((p, i) => ({ month: ymAdd(base, i), amount: String(Math.round(total * p / 100)) })))
  }

  async function save() {
    setSaving(true)
    try {
      const valid = rows.filter(r => /^\d{4}-\d{2}$/.test(r.month))
      for (const r of valid) {
        await fetch(`/api/contracts/${contractId}/payments`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ month: r.month, amount: num(r.amount) }),
        })
      }
      const keep = new Set(valid.map(r => r.month))
      for (const m of existing) {
        if (!keep.has(m)) await fetch(`/api/contracts/${contractId}/payments?month=${m}`, { method: "DELETE" })
      }
      router.refresh()
      onClose()
    } finally { setSaving(false) }
  }

  const inputStyle: React.CSSProperties = { padding: "7px 10px", border: "1px solid #ECE7DE", borderRadius: 7, fontSize: 13, background: "#fff", color: "#1A1916", fontFamily: "inherit", outline: "none" }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(26,25,22,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 1000 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 24, width: "min(560px, 100%)", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 12px 48px rgba(0,0,0,0.24)" }}>
        <div style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 22, fontWeight: 600, color: "#1A1916" }}>Payment schedule</div>
        <div style={{ fontSize: 13, color: "#9C9590", marginBottom: 16 }}>{projectName} · total {fmt$(total)}</div>

        {loading ? <div style={{ fontSize: 13, color: "#9C9590" }}>Loading…</div> : (
          <>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
              <button onClick={fillEven} style={chip}>Split evenly</button>
              <button onClick={() => fill403030([40, 40, 20])} style={chip}>40 / 40 / 20</button>
              <button onClick={() => fill403030([50, 50])} style={chip}>50 / 50</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr auto", gap: 8, alignItems: "center", marginBottom: 10 }}>
              <div style={hdr}>#</div><div style={hdr}>Month</div><div style={hdr}>Amount {sym}</div><div />
              {rows.map((r, i) => (
                <div key={i} style={{ display: "contents" }}>
                  <div style={{ fontSize: 12, color: "#9C9590", textAlign: "center" }}>{i + 1}</div>
                  <input style={inputStyle} type="month" value={r.month} onChange={e => setRow(i, { month: e.target.value })} />
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input style={{ ...inputStyle, flex: 1, width: "100%" }} type="number" min={0} value={r.amount} onChange={e => setRow(i, { amount: e.target.value })} />
                    {total > 0 && <span style={{ fontSize: 11, color: "#9C9590", minWidth: 34, textAlign: "right" }}>{Math.round(num(r.amount) / total * 100)}%</span>}
                  </div>
                  <button onClick={() => removeRow(i)} title="Remove" style={{ background: "none", border: "none", color: "#C4BFBA", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
                </div>
              ))}
            </div>

            <button onClick={addRow} style={{ ...chip, marginBottom: 14 }}>+ Add payment</button>

            <div style={{ fontSize: 13, color: scheduled === Math.round(total) ? "#1F7A4D" : "#C2410C", marginBottom: 16 }}>
              Scheduled: <strong>{fmt$(scheduled)}</strong> of {fmt$(total)}
              {scheduled !== Math.round(total) && <> · {scheduled > total ? "over" : "under"} by {fmt$(Math.abs(total - scheduled))}</>}
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
