"use client"
import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ymLabel } from "@/lib/calc"
import { useFmtCurrency } from "@/lib/CurrencyContext"
import {
  COST_CATEGORIES, deliveryMonths, deliveryWindow, personCostRate, projectMonthPnl, projectLifetimePnl, ymAdd,
  type ProfitContract, type ProfitInputs, type MonthPnl,
} from "@/lib/profit"
import type { Pulse } from "../../ProjectPulse"

interface Person { id: string; name: string; role: string | null; isExternal: boolean; annualSalary: number; billableHours: number }
interface Member { personId: string; role: string | null }
interface CostItem { id: string; contractId: string; name: string; category: string; reimbursed: boolean }

interface Props {
  clientSlug: string
  clientName: string
  minHourlyRate: number | null
  contract: ProfitContract & { productId: string | null }
  account: { id: string; name: string } | null
  products: { id: string; name: string; type: string }[]
  people: Person[]
  salaryMonths: ProfitInputs["salaryMonths"]
  capacityMonths: ProfitInputs["capacityMonths"]
  members: Member[]
  memberHours: ProfitInputs["memberHours"]
  contractHours: ProfitInputs["contractHours"]
  costItems: CostItem[]
  costMonths: ProfitInputs["costMonths"]
  accountMonths: ProfitInputs["accountMonths"]
  payments: ProfitInputs["payments"]
  pulses: Pulse[]
}

const now = new Date().toISOString().slice(0, 7)
const GRID_MONTHS = 6

const card: React.CSSProperties = { background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 20 }
const label: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "#6B6760", display: "block", marginBottom: 4 }
const input: React.CSSProperties = { padding: "7px 10px", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 13, fontFamily: "inherit", outline: "none", background: "#fff", color: "#1A1916", boxSizing: "border-box" }
const sectionTitle: React.CSSProperties = { fontFamily: "var(--font-cormorant), serif", fontSize: 20, fontWeight: 600, color: "#1A1916", margin: 0 }
const th: React.CSSProperties = { textAlign: "right", fontSize: 11, fontWeight: 600, color: "#9C9590", padding: "6px 10px", borderBottom: "1px solid #ECE7DE", whiteSpace: "nowrap" }
const thLeft: React.CSSProperties = { ...th, textAlign: "left" }
const td: React.CSSProperties = { padding: "8px 10px", fontSize: 13, textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", color: "#1A1916" }
const tdLeft: React.CSSProperties = { ...td, textAlign: "left" }
const btnPrimary: React.CSSProperties = { padding: "7px 14px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: "pointer" }
const btnGhost: React.CSSProperties = { padding: "7px 10px", background: "none", border: "1px solid #ECE7DE", borderRadius: 5, fontSize: 12, cursor: "pointer", color: "#6B6760" }
const btnOutline: React.CSSProperties = { background: "none", border: "1px solid #E9532A", borderRadius: 4, fontSize: 11, color: "#E9532A", cursor: "pointer", padding: "3px 10px", fontWeight: 600 }

const STATUS_LABEL: Record<string, string> = { active: "Active", finished: "Finished", potential: "Qualified", opportunity: "Opportunity", lost: "Lost" }
// Same palette as the Projects list, so a project reads the same in both places.
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  opportunity: { bg: "#EFF6FF", text: "#1D4ED8" },
  potential: { bg: "#FFF7ED", text: "#92400E" },
  active: { bg: "#DCFCE7", text: "#166534" },
  lost: { bg: "#FEF2F2", text: "#991B1B" },
  finished: { bg: "#F3F4F6", text: "#6B7280" },
}
// Pipeline order, matching the Projects list's Edit modal.
const STATUS_ORDER = ["opportunity", "potential", "active", "lost", "finished"]
const TYPE_LABEL: Record<string, string> = { retainer: "Retainer", ongoing: "Ongoing", oneoff: "One-off" }

// Click-to-edit numeric cell. Blank / 0 clears the value.
function EditCell({ value, display, onSave, disabled, placeholder = "—" }: {
  value: number | null
  display: (v: number) => string
  onSave: (v: number) => Promise<boolean>
  disabled?: boolean
  placeholder?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  function start() { if (disabled) return; setDraft(value != null && value > 0 ? String(value) : ""); setEditing(true); setFailed(false) }
  async function commit() {
    setEditing(false)
    const v = draft.trim() === "" ? 0 : parseFloat(draft.replace(/[$,\s]/g, ""))
    if (isNaN(v) || v < 0 || v === (value ?? 0)) return
    setSaving(true)
    const ok = await onSave(v)
    setSaving(false)
    setFailed(!ok)
  }
  if (editing) {
    return (
      <input autoFocus value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false) }}
        style={{ ...input, width: 76, padding: "3px 6px", textAlign: "right", fontSize: 13 }} />
    )
  }
  return (
    <span onClick={start} title={disabled ? undefined : "Click to edit"}
      style={{ display: "inline-block", minWidth: 56, padding: "3px 6px", borderRadius: 4, cursor: disabled ? "default" : "pointer", color: value != null && value > 0 ? "#1A1916" : "#C0BAB2", background: failed ? "#FBEAE4" : "transparent", opacity: saving ? 0.5 : 1, border: disabled ? "none" : "1px dashed transparent" }}
      onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLElement).style.borderColor = "#ECE7DE" }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "transparent" }}>
      {value != null && value > 0 ? display(value) : placeholder}
    </span>
  )
}

function fmtHrs(h: number) { return `${Math.round(h * 10) / 10}h` }
function fmtPct(p: number | null) { return p == null ? "—" : `${Math.round(p)}%` }
function marginColor(p: number | null) { return p == null ? "#9C9590" : p < 0 ? "#B23A1B" : p < 30 ? "#B45309" : "#15803D" }

export default function ProjectDetailClient(props: Props) {
  const fmt = useFmtCurrency()
  const router = useRouter()
  const { clientSlug, clientName, account, people, products } = props
  // Status, service and owner are editable in the header; everything else routes
  // back through the Projects list's Edit modal.
  const [contract, setContract] = useState(props.contract)
  type Patch = { status?: string; productId?: string | null; ownerId?: string | null; start?: string; contractedThrough?: string | null; deliveryStart?: string | null; deliveryEnd?: string | null }
  const [savingField, setSavingField] = useState<keyof Patch | null>(null)
  // Which field the last failed save came from, so the reason shows where it happened.
  const [saveError, setSaveError] = useState<{ field: keyof Patch; msg: string } | null>(null)
  async function patchContract(patch: Patch) {
    const key = Object.keys(patch)[0] as keyof Patch
    setSavingField(key)
    setSaveError(null)
    const res = await fetch(`/api/contracts/${contract.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) })
    if (res.ok) {
      setContract(prev => ({ ...prev, ...patch }))
      // Status files the project under a different section everywhere else, so
      // let the server views re-read it rather than go stale behind this page.
      if (key === "status") router.refresh()
    }
    else setSaveError({ field: key, msg: (await res.json().catch(() => null))?.error ?? "Couldn't save" })
    setSavingField(null)
  }
  // Delivery dates: retainers edit start / contracted-through; one-offs edit their
  // delivery window (payment month stays on `start`).
  const isOneoff = contract.type === "oneoff"
  const dateStartKey: keyof Patch = isOneoff ? "deliveryStart" : "start"
  const dateEndKey: keyof Patch = isOneoff ? "deliveryEnd" : "contractedThrough"
  const dateStartVal = isOneoff ? (contract.deliveryStart || contract.start) : contract.start
  const dateEndVal = isOneoff ? (contract.deliveryEnd || contract.contractedThrough || "") : (contract.contractedThrough ?? "")
  const isOngoing = !isOneoff && contract.contractedThrough === null
  const monthInput: React.CSSProperties = { ...input, width: 130, padding: "5px 8px", fontSize: 13 }
  const dateError = saveError && (saveError.field === dateStartKey || saveError.field === dateEndKey) ? saveError.msg : null
  const statusError = saveError?.field === "status" ? saveError.msg : null
  const statusColors = STATUS_COLORS[contract.status] ?? STATUS_COLORS.finished

  const [members, setMembers] = useState<Member[]>(props.members)
  const [memberHours, setMemberHours] = useState(props.memberHours)
  const [contractHours, setContractHours] = useState(props.contractHours)
  const [costItems, setCostItems] = useState<CostItem[]>(props.costItems)
  const [costMonths, setCostMonths] = useState(props.costMonths)

  // Month columns: a window over the delivery months, ending at the current month
  // (or the project's end, if that's earlier). Arrows shift the window.
  const window_ = deliveryWindow(contract, now)
  const allMonths = deliveryMonths(contract, now)
  const defaultEnd = window_.end < now ? window_.end : now
  const [endMonth, setEndMonth] = useState(defaultEnd)
  const months = useMemo(() => {
    const out: string[] = []
    for (let i = GRID_MONTHS - 1; i >= 0; i--) out.push(ymAdd(endMonth, -i))
    return out
  }, [endMonth])
  const inWindow = (m: string) => window_.start <= m && m <= window_.end
  // Hours logged in months the project isn't running: revenue is 0 there, so
  // they read as pure loss. Flag it — it usually means the start date is wrong.
  const strayMonths = Array.from(new Set(memberHours.filter(h => h.hours > 0 && !inWindow(h.month)).map(h => h.month))).sort()
  const canEarlier = months[0] > window_.start
  const canLater = endMonth < window_.end && endMonth < ymAdd(now, 12)

  const inputs: ProfitInputs = useMemo(() => ({
    people, salaryMonths: props.salaryMonths, capacityMonths: props.capacityMonths,
    memberHours, contractHours, costItems, costMonths, accountMonths: props.accountMonths, payments: props.payments,
  }), [people, props.salaryMonths, props.capacityMonths, memberHours, contractHours, costItems, costMonths, props.accountMonths, props.payments])

  const pnlByMonth = useMemo(() => {
    const m = new Map<string, MonthPnl>()
    for (const ym of months) m.set(ym, projectMonthPnl(contract, ym, inputs, now))
    return m
  }, [months, contract, inputs])

  // Project to date: every delivery month up to now (or the end, once it's past).
  const isFinished = contract.status === "finished" || window_.end < now
  const lifetime = useMemo(() => projectLifetimePnl(contract, inputs, now), [contract, inputs])
  const coverage = `${lifetime.loggedMonths ?? 0} of ${lifetime.elapsedMonths ?? 0} months logged`
  const partial = (lifetime.loggedMonths ?? 0) < (lifetime.elapsedMonths ?? 0)


  // ── Team rows: the owner, then assigned members. Vendors that were assigned
  // earlier still show, but new vendors belong in Costs.
  const teamRows = useMemo(() => {
    const ids: string[] = []
    if (contract.ownerId) ids.push(contract.ownerId)
    for (const m of members) if (!ids.includes(m.personId)) ids.push(m.personId)
    // Anyone with hours logged but no longer assigned still needs to be visible.
    for (const h of memberHours) if (h.hours > 0 && !ids.includes(h.personId)) ids.push(h.personId)
    return ids.map(id => {
      const p = people.find(pp => pp.id === id)
      const m = members.find(mm => mm.personId === id)
      return { id, person: p, role: id === contract.ownerId ? (m?.role ?? "Owner") : m?.role ?? null, isOwner: id === contract.ownerId, assigned: !!m || id === contract.ownerId }
    })
  }, [contract.ownerId, members, memberHours, people])

  const hoursOf = (personId: string, m: string) => memberHours.find(h => h.personId === personId && h.month === m)?.hours ?? null
  const hasMemberRows = (m: string) => memberHours.some(h => h.month === m && h.hours > 0)
  const legacyTotal = (m: string) => contractHours.find(h => h.month === m)?.hours ?? null

  async function saveHours(personId: string, month: string, hours: number): Promise<boolean> {
    const res = await fetch(`/api/contracts/${contract.id}/member-hours`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personId, month, hours }),
    })
    if (!res.ok) return false
    const data = await res.json() as { total: number }
    setMemberHours(prev => {
      const rest = prev.filter(h => !(h.personId === personId && h.month === month))
      return hours > 0 ? [...rest, { contractId: contract.id, personId, month, hours }] : rest
    })
    setContractHours(prev => {
      const rest = prev.filter(h => h.month !== month)
      return data.total > 0 ? [...rest, { contractId: contract.id, month, hours: data.total }] : rest
    })
    return true
  }

  // ── Add / remove team members
  const [addingMember, setAddingMember] = useState(false)
  const [memberForm, setMemberForm] = useState({ personId: "", role: "" })
  const assignable = people.filter(p => !p.isExternal && !teamRows.some(r => r.id === p.id))

  async function addMember(e: React.FormEvent) {
    e.preventDefault()
    if (!memberForm.personId) return
    const res = await fetch(`/api/contracts/${contract.id}/members`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personId: memberForm.personId, role: memberForm.role || undefined }),
    })
    if (!res.ok) return
    setMembers(prev => [...prev.filter(m => m.personId !== memberForm.personId), { personId: memberForm.personId, role: memberForm.role || null }])
    setMemberForm({ personId: "", role: "" })
    setAddingMember(false)
  }
  async function removeMember(personId: string) {
    const res = await fetch(`/api/contracts/${contract.id}/members?personId=${encodeURIComponent(personId)}`, { method: "DELETE" })
    if (!res.ok) return
    setMembers(prev => prev.filter(m => m.personId !== personId))
  }

  // ── Cost items
  const [addingCost, setAddingCost] = useState(false)
  const [costForm, setCostForm] = useState({ name: "", category: "content", reimbursed: false })
  const amountOf = (itemId: string, m: string) => costMonths.find(c => c.costItemId === itemId && c.month === m)?.amount ?? null

  async function addCostItem(e: React.FormEvent) {
    e.preventDefault()
    if (!costForm.name.trim()) return
    const res = await fetch(`/api/contracts/${contract.id}/costs`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(costForm),
    })
    if (!res.ok) return
    const item = await res.json() as CostItem
    setCostItems(prev => [...prev, { id: item.id, contractId: item.contractId, name: item.name, category: item.category, reimbursed: item.reimbursed }])
    setCostForm({ name: "", category: "content", reimbursed: false })
    setAddingCost(false)
  }
  async function patchCostItem(itemId: string, patch: Partial<Pick<CostItem, "name" | "category" | "reimbursed">>) {
    const res = await fetch(`/api/contracts/${contract.id}/costs/${itemId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
    })
    if (!res.ok) return
    setCostItems(prev => prev.map(i => i.id === itemId ? { ...i, ...patch } : i))
  }
  async function deleteCostItem(itemId: string) {
    const item = costItems.find(i => i.id === itemId)
    if (!item || !confirm(`Remove "${item.name}" and all its monthly amounts?`)) return
    const res = await fetch(`/api/contracts/${contract.id}/costs/${itemId}`, { method: "DELETE" })
    if (!res.ok) return
    setCostItems(prev => prev.filter(i => i.id !== itemId))
    setCostMonths(prev => prev.filter(c => c.costItemId !== itemId))
  }
  async function saveCostMonth(itemId: string, month: string, amount: number): Promise<boolean> {
    const res = await fetch(`/api/contracts/${contract.id}/costs/${itemId}/months`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month, amount }),
    })
    if (!res.ok) return false
    setCostMonths(prev => {
      const rest = prev.filter(c => !(c.costItemId === itemId && c.month === month))
      return amount > 0 ? [...rest, { costItemId: itemId, month, amount }] : rest
    })
    return true
  }

  const missingRates = Array.from(new Set(months.flatMap(m => pnlByMonth.get(m)?.missingRates ?? [])))
  const anyReimbursed = costItems.some(i => i.reimbursed)

  const feeLabel = contract.type === "oneoff" ? `${fmt(contract.monthly)} total` : `${fmt(contract.monthly)}/mo`
  // Tiles are project-to-date (Final once finished) — the per-month story is the
  // table below.
  const scope = isFinished ? "Final" : "To date"
  const tiles = [
    { label: `${scope} margin`, value: fmt(lifetime.margin), sub: `${fmtPct(lifetime.marginPct)} of ${fmt(lifetime.revenue)} · ${coverage}`, color: marginColor(lifetime.marginPct) },
    { label: `${scope} revenue`, value: fmt(lifetime.revenue), sub: `${fmt(lifetime.teamCost)} team · ${fmt(lifetime.directCost)} costs`, color: "#1A1916" },
    { label: "Revenue / hr", value: lifetime.perHr != null ? fmt(lifetime.perHr) : "—", sub: lifetime.hours > 0 ? `${fmtHrs(lifetime.hours)} logged ${scope.toLowerCase()}` : "no hours logged", color: props.minHourlyRate && lifetime.perHr != null && lifetime.perHr < props.minHourlyRate ? "#B23A1B" : "#1A1916" },
    { label: "Team cost / hr", value: lifetime.costPerHr != null ? fmt(lifetime.costPerHr) : "—", sub: lifetime.teamCost > 0 ? `blended across ${fmtHrs(lifetime.hours)}` : "assign hours below", color: "#1A1916" },
  ]

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <style>{`
        @media (max-width: 720px) { .proj-tiles { grid-template-columns: 1fr 1fr !important; } }
        .proj-scroll { overflow-x: auto; }
        .proj-scroll table { border-collapse: collapse; width: 100%; }
        .proj-row:hover td { background: #FBFAF7; }
      `}</style>

      {/* Breadcrumb */}
      <div style={{ fontSize: 12, color: "#9C9590" }}>
        <Link href={`/clients/${clientSlug}/projects`} style={{ color: "#9C9590", textDecoration: "none" }}>← {clientName} · Projects</Link>
      </div>

      {/* Header */}
      <div style={{ ...card, display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 20 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 30, fontWeight: 700, color: "#1A1916", margin: "0 0 6px" }}>{contract.name}</h1>
          <div style={{ fontSize: 13, color: "#6B6760", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {account
              ? <Link href={`/clients/${clientSlug}/accounts/${account.id}`} style={{ color: "#E9532A", textDecoration: "none", fontWeight: 600 }}>{account.name}</Link>
              : <span style={{ color: "#9C9590" }}>No account</span>}
            <span style={{ color: "#C0BAB2" }}>·</span>
            <span>{TYPE_LABEL[contract.type] ?? contract.type}</span>
            <span style={{ color: "#C0BAB2" }}>·</span>
            <span style={{ position: "relative", display: "inline-flex", alignItems: "center", opacity: savingField === "status" ? 0.6 : 1 }}>
              <select value={contract.status} onChange={e => patchContract({ status: e.target.value })} title="Change status"
                style={{ appearance: "none", WebkitAppearance: "none", fontFamily: "inherit", fontSize: 11, fontWeight: 700, padding: "3px 22px 3px 9px", borderRadius: 20, border: "none", background: statusColors.bg, color: statusColors.text, cursor: "pointer", outline: "none" }}>
                {STATUS_ORDER.map(v => <option key={v} value={v}>{STATUS_LABEL[v]}</option>)}
              </select>
              <span aria-hidden style={{ position: "absolute", right: 8, fontSize: 9, color: statusColors.text, pointerEvents: "none" }}>▾</span>
            </span>
          </div>
          {statusError && <div style={{ fontSize: 11, color: "#B23A1B", marginTop: 6 }}>{statusError} — set it in the Delivery field.</div>}
        </div>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div>
            <div style={label}>Fee</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#1A1916" }}>{feeLabel}</div>
            {contract.hoursPerMonth > 0 && <div style={{ fontSize: 11, color: "#9C9590" }}>{contract.hoursPerMonth}h sold{contract.type === "oneoff" ? "" : "/mo"}</div>}
          </div>
          <div>
            <div style={label}>Delivery{isOneoff && <span style={{ color: "#C0BAB2", fontWeight: 400 }}> (work window)</span>}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="month" value={dateStartVal} onChange={e => { if (e.target.value) patchContract({ [dateStartKey]: e.target.value } as Patch) }}
                style={{ ...monthInput, opacity: savingField === dateStartKey ? 0.6 : 1 }} />
              <span style={{ color: "#9C9590" }}>→</span>
              <input type="month" value={dateEndVal} placeholder="ongoing" onChange={e => patchContract({ [dateEndKey]: e.target.value || null } as Patch)}
                style={{ ...monthInput, opacity: savingField === dateEndKey ? 0.6 : 1, color: dateEndVal ? "#1A1916" : "#9C9590" }} />
            </div>
            <div style={{ fontSize: 11, color: dateError ? "#B23A1B" : "#9C9590", marginTop: 3 }}>
              {dateError ?? (isOngoing ? "ongoing — no end month set" : `${allMonths.length} month${allMonths.length === 1 ? "" : "s"}`)}
            </div>
          </div>
          <div>
            <div style={label}>Service</div>
            <select value={contract.productId ?? ""} onChange={e => patchContract({ productId: e.target.value || null })}
              style={{ ...input, width: 200, opacity: savingField === "productId" ? 0.6 : 1, cursor: "pointer" }}>
              <option value="">— None —</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <div style={label}>Owner</div>
            <select value={contract.ownerId ?? ""} onChange={e => patchContract({ ownerId: e.target.value || null })}
              style={{ ...input, width: 170, opacity: savingField === "ownerId" ? 0.6 : 1, cursor: "pointer" }}>
              <option value="">— Unassigned —</option>
              {people.filter(p => !p.isExternal).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Tiles */}
      <div className="proj-tiles" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {tiles.map((t, i) => (
          <div key={i} style={{ ...card, padding: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9C9590" }}>{t.label}</div>
            <div style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 26, fontWeight: 700, margin: "4px 0 2px", color: t.color }}>{t.value}</div>
            <div style={{ fontSize: 11, color: "#9C9590" }}>{t.sub}</div>
          </div>
        ))}
      </div>

      {missingRates.length > 0 && (
        <div style={{ background: "#FEF3C7", border: "1px solid #F3D68B", borderRadius: 12, padding: "12px 18px", fontSize: 13, color: "#8A5A0B" }}>
          <strong>No cost rate for {missingRates.join(", ")}</strong> — their hours aren&apos;t counted in team cost. Set a salary and billable hours on the{" "}
          <Link href={`/clients/${clientSlug}/team`} style={{ color: "#8A5A0B" }}>Team tab</Link>.
        </div>
      )}

      {strayMonths.length > 0 && (
        <div style={{ background: "#FBEAE4", border: "1px solid #F3C4B4", borderRadius: 12, padding: "12px 18px", fontSize: 13, color: "#8A4A38" }}>
          <strong>Hours logged outside the delivery window</strong> ({strayMonths.map(ymLabel).join(", ")}) — this project runs {ymLabel(window_.start)} → {ymLabel(window_.end)}, so those months have cost but no revenue. If the work really started earlier, edit the project&apos;s start date on the{" "}
          <Link href={`/clients/${clientSlug}/projects`} style={{ color: "#8A4A38" }}>Projects list</Link>.
        </div>
      )}

      {/* Month window control */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#6B6760" }}>
        <button onClick={() => setEndMonth(m => ymAdd(m, -GRID_MONTHS))} disabled={!canEarlier} style={{ ...btnGhost, opacity: canEarlier ? 1 : 0.4 }}>← Earlier</button>
        <span style={{ fontWeight: 600 }}>{ymLabel(months[0])} – {ymLabel(months[months.length - 1])}</span>
        <button onClick={() => setEndMonth(m => { const n = ymAdd(m, GRID_MONTHS); return n > window_.end ? window_.end : n })} disabled={!canLater} style={{ ...btnGhost, opacity: canLater ? 1 : 0.4 }}>Later →</button>
        {endMonth !== defaultEnd && <button onClick={() => setEndMonth(defaultEnd)} style={{ ...btnGhost, border: "none", color: "#E9532A" }}>Today</button>}
      </div>

      {/* Team & hours */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10, flexWrap: "wrap" }}>
          <div>
            <h2 style={sectionTitle}>Team &amp; hours</h2>
            <div style={{ fontSize: 11, color: "#9C9590", marginTop: 2 }}>Enter the hours each person worked on this project each month. Team cost is calculated from those hours × their cost/hr (salary ÷ billable hours, from the Team tab).</div>
          </div>
          <button onClick={() => setAddingMember(v => !v)} style={btnOutline}>+ Team member</button>
        </div>
        {addingMember && (
          <form onSubmit={addMember} style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 14, flexWrap: "wrap", background: "#FBFAF7", border: "1px solid #ECE7DE", borderRadius: 8, padding: 12 }}>
            <div><label style={label}>Person</label>
              <select value={memberForm.personId} onChange={e => setMemberForm(f => ({ ...f, personId: e.target.value }))} required style={{ ...input, width: 200 }}>
                <option value="">— Select —</option>
                {assignable.map(p => <option key={p.id} value={p.id}>{p.name}{p.role ? ` · ${p.role}` : ""}</option>)}
              </select>
            </div>
            <div><label style={label}>Title on project</label><input style={{ ...input, width: 170 }} value={memberForm.role} onChange={e => setMemberForm(f => ({ ...f, role: e.target.value }))} placeholder="Content Writer" /></div>
            <button type="submit" style={btnPrimary}>Add</button>
            <button type="button" onClick={() => setAddingMember(false)} style={btnGhost}>Cancel</button>
            <span style={{ fontSize: 11, color: "#9C9590", flexBasis: "100%" }}>Vendors and freelancers go under Costs below.</span>
          </form>
        )}
        <div className="proj-scroll">
          <table>
            <thead>
              <tr>
                <th style={{ ...thLeft, borderBottom: "none" }} />
                <th colSpan={months.length} style={{ ...th, textAlign: "center", borderBottom: "none", color: "#B0A9A0", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: 10, paddingBottom: 0 }}>Hours worked</th>
                <th style={{ ...th, borderBottom: "none" }} />
                <th style={{ ...th, borderBottom: "none" }} />
              </tr>
              <tr>
                <th style={thLeft}>Person</th>
                {months.map(m => <th key={m} title={inWindow(m) ? undefined : "Outside the delivery window"} style={{ ...th, color: m === now ? "#E9532A" : th.color, opacity: inWindow(m) ? 1 : 0.45, textDecoration: inWindow(m) ? "none" : "line-through" }}>{ymLabel(m)}</th>)}
                <th style={{ ...th, borderLeft: "1px solid #ECE7DE" }} title={`What an hour of this person costs the agency in ${ymLabel(endMonth)}: monthly salary ÷ billable hours (Team tab)`}>Cost/hr</th>
                <th style={{ ...th, width: 24 }} />
              </tr>
            </thead>
            <tbody>
              {teamRows.length === 0 && (
                <tr><td colSpan={months.length + 3} style={{ ...tdLeft, color: "#9C9590" }}>No one assigned yet — add a team member to start logging hours.</td></tr>
              )}
              {teamRows.map(r => {
                const rate = r.person ? personCostRate(r.person, endMonth, props.salaryMonths, props.capacityMonths) : null
                // Month-specific salary/hours overrides on the Team tab change the rate
                // month to month; when they do, show the rate under each cell.
                const rateVaries = !!r.person && months.some(m => {
                  const mr = personCostRate(r.person!, m, props.salaryMonths, props.capacityMonths)
                  return (mr == null) !== (rate == null) || (mr != null && rate != null && Math.round(mr) !== Math.round(rate))
                })
                return (
                  <tr key={r.id} className="proj-row" style={{ borderTop: "1px solid #F5F1EC" }}>
                    <td style={tdLeft}>
                      <span style={{ fontWeight: 600 }}>{r.person?.name ?? "—"}</span>
                      {r.isOwner && <span style={{ fontSize: 9, fontWeight: 700, color: "#E9532A", background: "#FBEAE4", borderRadius: 4, padding: "1px 5px", marginLeft: 6 }}>OWNER</span>}
                      {r.person?.isExternal && <span style={{ fontSize: 9, fontWeight: 700, color: "#B45309", background: "#FEF3C7", borderRadius: 4, padding: "1px 5px", marginLeft: 6 }}>VENDOR</span>}
                      {r.role && !r.isOwner && <span style={{ color: "#9C9590", fontWeight: 400 }}> · {r.role}</span>}
                    </td>
                    {months.map(m => {
                      const mRate = r.person ? personCostRate(r.person, m, props.salaryMonths, props.capacityMonths) : null
                      const differs = mRate != null && rate != null && Math.round(mRate) !== Math.round(rate)
                      return (
                        <td key={m} style={{ ...td, padding: "4px 6px", background: inWindow(m) ? undefined : "#FBFAF7" }}>
                          <EditCell value={hoursOf(r.id, m)} display={fmtHrs} placeholder="0h" onSave={v => saveHours(r.id, m, v)} />
                          {rateVaries && (
                            <div style={{ fontSize: 10, color: differs ? "#B45309" : "#C0BAB2", marginTop: -2 }} title={`Cost/hr in ${ymLabel(m)} (salary override on the Team tab)`}>
                              {mRate == null ? "no rate" : `@ ${fmt(mRate)}`}
                            </div>
                          )}
                        </td>
                      )
                    })}
                    <td style={{ ...td, color: rate == null ? "#C0BAB2" : "#6B6760", borderLeft: "1px solid #ECE7DE" }}>
                      {rate == null ? "—" : fmt(rate)}
                      {rateVaries && <div style={{ fontSize: 10, color: "#B45309" }}>varies by month</div>}
                    </td>
                    <td style={{ ...td, padding: "4px 6px" }}>
                      {!r.isOwner && r.assigned && <button onClick={() => removeMember(r.id)} title="Remove from project" style={{ background: "none", border: "none", color: "#C0BAB2", cursor: "pointer", fontSize: 15, lineHeight: 1 }}>×</button>}
                    </td>
                  </tr>
                )
              })}
              {/* Hours logged as a project total (Yield view) before anyone was assigned. */}
              {months.some(m => !hasMemberRows(m) && (legacyTotal(m) ?? 0) > 0) && (
                <tr style={{ borderTop: "1px solid #F5F1EC" }}>
                  <td style={{ ...tdLeft, color: "#9C9590", fontStyle: "italic" }}>Unassigned (logged as project total)</td>
                  {months.map(m => <td key={m} style={{ ...td, color: "#9C9590" }}>{!hasMemberRows(m) && (legacyTotal(m) ?? 0) > 0 ? fmtHrs(legacyTotal(m) as number) : ""}</td>)}
                  <td style={{ ...td, borderLeft: "1px solid #ECE7DE" }} />
                  <td />
                </tr>
              )}
              <tr style={{ borderTop: "2px solid #ECE7DE", background: "#FBFAF7" }}>
                <td style={{ ...tdLeft, fontWeight: 700 }}>Total hours</td>
                {months.map(m => { const p = pnlByMonth.get(m)!; return <td key={m} style={{ ...td, fontWeight: 700 }}>{p.hours > 0 ? fmtHrs(p.hours) : <span style={{ color: "#C0BAB2" }}>—</span>}</td> })}
                <td style={{ ...td, borderLeft: "1px solid #ECE7DE" }} />
                <td />
              </tr>
              <tr style={{ background: "#FBFAF7" }}>
                <td style={{ ...tdLeft, fontWeight: 700 }}>Team cost <span style={{ fontWeight: 400, color: "#9C9590", fontSize: 11 }}>= hours × cost/hr</span></td>
                {months.map(m => { const p = pnlByMonth.get(m)!; return <td key={m} style={{ ...td, fontWeight: 700 }}>{p.teamCost > 0 ? fmt(p.teamCost) : <span style={{ color: "#C0BAB2" }}>—</span>}</td> })}
                <td style={{ ...td, borderLeft: "1px solid #ECE7DE" }} />
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Costs */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10, flexWrap: "wrap" }}>
          <div>
            <h2 style={sectionTitle}>Costs</h2>
            <div style={{ fontSize: 11, color: "#9C9590", marginTop: 2 }}>Line items the agency pays for on this project — content, vendors, ad spend, software. Enter the amount per month.</div>
          </div>
          <button onClick={() => setAddingCost(v => !v)} style={btnOutline}>+ Cost item</button>
        </div>
        {addingCost && (
          <form onSubmit={addCostItem} style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 14, flexWrap: "wrap", background: "#FBFAF7", border: "1px solid #ECE7DE", borderRadius: 8, padding: 12 }}>
            <div><label style={label}>Item</label><input style={{ ...input, width: 200 }} value={costForm.name} onChange={e => setCostForm(f => ({ ...f, name: e.target.value }))} placeholder="Blog Posts" required autoFocus /></div>
            <div><label style={label}>Category</label>
              <select value={costForm.category} onChange={e => setCostForm(f => ({ ...f, category: e.target.value }))} style={{ ...input, width: 170 }}>
                {COST_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6B6760", paddingBottom: 8 }}>
              <input type="checkbox" checked={costForm.reimbursed} onChange={e => setCostForm(f => ({ ...f, reimbursed: e.target.checked }))} /> Client reimburses this
            </label>
            <button type="submit" style={btnPrimary}>Add</button>
            <button type="button" onClick={() => setAddingCost(false)} style={btnGhost}>Cancel</button>
          </form>
        )}
        <div className="proj-scroll">
          <table>
            <thead>
              <tr>
                <th style={thLeft}>Item</th>
                <th style={thLeft}>Category</th>
                {months.map(m => <th key={m} title={inWindow(m) ? undefined : "Outside the delivery window"} style={{ ...th, color: m === now ? "#E9532A" : th.color, opacity: inWindow(m) ? 1 : 0.45, textDecoration: inWindow(m) ? "none" : "line-through" }}>{ymLabel(m)}</th>)}
                <th style={{ ...th, width: 24 }} />
              </tr>
            </thead>
            <tbody>
              {costItems.length === 0 && (
                <tr><td colSpan={months.length + 3} style={{ ...tdLeft, color: "#9C9590" }}>No costs yet.</td></tr>
              )}
              {costItems.map(item => (
                <tr key={item.id} className="proj-row" style={{ borderTop: "1px solid #F5F1EC", opacity: item.reimbursed ? 0.7 : 1 }}>
                  <td style={tdLeft}>
                    <span style={{ fontWeight: 600 }}>{item.name}</span>
                    {item.reimbursed && <span title="Client reimburses — excluded from margin" style={{ fontSize: 9, fontWeight: 700, color: "#6B6760", background: "#F5F1EC", borderRadius: 4, padding: "1px 5px", marginLeft: 6 }}>REIMBURSED</span>}
                  </td>
                  <td style={tdLeft}>
                    <select value={item.category} onChange={e => patchCostItem(item.id, { category: e.target.value })}
                      style={{ fontSize: 12, border: "1px solid transparent", borderRadius: 5, padding: "2px 4px", color: "#6B6760", background: "transparent", outline: "none", cursor: "pointer" }}>
                      {COST_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                  </td>
                  {months.map(m => (
                    <td key={m} style={{ ...td, padding: "4px 6px", background: inWindow(m) ? undefined : "#FBFAF7" }}>
                      <EditCell value={amountOf(item.id, m)} display={fmt} onSave={v => saveCostMonth(item.id, m, v)} />
                    </td>
                  ))}
                  <td style={{ ...td, padding: "4px 6px", whiteSpace: "nowrap" }}>
                    <button onClick={() => patchCostItem(item.id, { reimbursed: !item.reimbursed })} title={item.reimbursed ? "Mark as an agency cost" : "Mark as reimbursed by the client"} style={{ background: "none", border: "none", color: "#C0BAB2", cursor: "pointer", fontSize: 12 }}>↺</button>
                    <button onClick={() => deleteCostItem(item.id)} title="Remove item" style={{ background: "none", border: "none", color: "#C0BAB2", cursor: "pointer", fontSize: 15, lineHeight: 1 }}>×</button>
                  </td>
                </tr>
              ))}
              <tr style={{ borderTop: "2px solid #ECE7DE", background: "#FBFAF7" }}>
                <td style={{ ...tdLeft, fontWeight: 700 }} colSpan={2}>Direct costs</td>
                {months.map(m => { const p = pnlByMonth.get(m)!; return <td key={m} style={{ ...td, fontWeight: 700 }}>{p.directCost > 0 ? fmt(p.directCost) : <span style={{ color: "#C0BAB2" }}>—</span>}</td> })}
                <td />
              </tr>
              {anyReimbursed && (
                <tr style={{ background: "#FBFAF7" }}>
                  <td style={{ ...tdLeft, color: "#9C9590" }} colSpan={2}>Reimbursed (not in margin)</td>
                  {months.map(m => { const p = pnlByMonth.get(m)!; return <td key={m} style={{ ...td, color: "#9C9590" }}>{p.reimbursed > 0 ? fmt(p.reimbursed) : "—"}</td> })}
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* P&L */}
      <div style={card}>
        <div style={{ marginBottom: 12 }}>
          <h2 style={sectionTitle}>Profit by month</h2>
          <div style={{ fontSize: 11, color: "#9C9590", marginTop: 2 }}>
            Margin = revenue − team cost − direct costs. {contract.type === "oneoff" ? "One-off revenue is spread evenly across the delivery months." : "Revenue is the reconciled actual for the month, else the fee."} Overhead isn&apos;t allocated.
            {partial && <> <span style={{ color: "#B45309" }}>* {isFinished ? "Final" : "To date"} covers only the {coverage} — months with no hours or costs are left out rather than counted as pure profit.</span></>}
          </div>
        </div>
        <div className="proj-scroll">
          <table>
            <thead>
              <tr>
                <th style={thLeft} />
                {months.map(m => <th key={m} title={inWindow(m) ? undefined : "Outside the delivery window"} style={{ ...th, color: m === now ? "#E9532A" : th.color, opacity: inWindow(m) ? 1 : 0.45, textDecoration: inWindow(m) ? "none" : "line-through" }}>{ymLabel(m)}</th>)}
                <th style={{ ...th, borderLeft: "2px solid #ECE7DE", color: "#1A1916" }} title={coverage}>{isFinished ? "Final" : "To date"}{partial && <span style={{ color: "#B45309" }}>*</span>}</th>
              </tr>
            </thead>
            <tbody>
              {([
                ["Revenue", (p: MonthPnl) => p.revenue > 0 ? fmt(p.revenue) : "—", false],
                ["Hours", (p: MonthPnl) => p.hours > 0 ? fmtHrs(p.hours) : "—", false],
                ["Team cost", (p: MonthPnl) => p.teamCost > 0 ? `−${fmt(p.teamCost)}` : "—", false],
                ["Direct costs", (p: MonthPnl) => p.directCost > 0 ? `−${fmt(p.directCost)}` : "—", false],
                ["Margin", (p: MonthPnl) => p.revenue > 0 || p.teamCost > 0 || p.directCost > 0 ? fmt(p.margin) : "—", true],
                ["Margin %", (p: MonthPnl) => fmtPct(p.marginPct), true],
                ["Revenue / hr", (p: MonthPnl) => p.perHr != null ? fmt(p.perHr) : "—", false],
                ["Team cost / hr", (p: MonthPnl) => p.costPerHr != null ? fmt(p.costPerHr) : "—", false],
              ] as [string, (p: MonthPnl) => string, boolean][]).map(([name, render, isMargin]) => (
                <tr key={name} style={{ borderTop: isMargin && name === "Margin" ? "2px solid #ECE7DE" : "1px solid #F5F1EC", background: isMargin ? "#FBFAF7" : undefined }}>
                  <td style={{ ...tdLeft, fontWeight: isMargin ? 700 : 600, color: "#6B6760" }}>{name}</td>
                  {months.map(m => {
                    const p = pnlByMonth.get(m)!
                    const v = render(p)
                    return <td key={m} style={{ ...td, fontWeight: isMargin ? 700 : 400, color: v === "—" ? "#C0BAB2" : isMargin ? marginColor(p.marginPct) : td.color }}>{v}</td>
                  })}
                  {(() => { const v = render(lifetime); return <td style={{ ...td, fontWeight: 700, borderLeft: "2px solid #ECE7DE", color: v === "—" ? "#C0BAB2" : isMargin ? marginColor(lifetime.marginPct) : td.color }}>{v}</td> })()}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
