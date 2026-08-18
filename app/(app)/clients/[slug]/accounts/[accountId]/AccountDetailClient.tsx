"use client"
import { useState } from "react"
import Link from "next/link"
import { fmtCurrency, ymAdd, ymLabel, ymDiff } from "@/lib/calc"
import { useFmtCurrency } from "@/lib/CurrencyContext"
import ProjectPulse, { pulseColor, type Pulse } from "../../ProjectPulse"

interface Account { id: string; name: string; contactName: string | null; contactEmail: string | null; ownerId: string | null }
interface Person { id: string; name: string; role: string | null; isExternal: boolean }
interface Product { id: string; name: string; type: "retainer" | "ongoing" | "oneoff"; monthly: number }
interface Contract {
  id: string; name: string; monthly: number; hoursPerMonth: number
  start: string; contractedThrough: string | null; status: string; type: string; ownerId: string | null
}
interface HoursRow { contractId: string; month: string; hours: number }
interface PaymentRow { contractId: string; month: string; amount: number }
interface Member { contractId: string; personId: string; role: string | null }
interface Note { id: string; body: string; author: string | null; createdAt: string }

interface Props {
  clientId: string
  clientSlug: string
  clientName: string
  minHourlyRate: number | null
  account: Account
  allAccounts: { id: string; name: string }[]
  people: Person[]
  products: Product[]
  contracts: Contract[]
  pulses: Pulse[]
  hours: HoursRow[]
  payments: PaymentRow[]
  members: Member[]
  notes: Note[]
}

const now = new Date().toISOString().slice(0, 7)
const GRID_MONTHS = 6

const card: React.CSSProperties = { background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 20 }
const label: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "#6B6760", display: "block", marginBottom: 4 }
const input: React.CSSProperties = { padding: "7px 10px", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 13, fontFamily: "inherit", outline: "none", background: "#fff", color: "#1A1916", boxSizing: "border-box", width: "100%" }
const sectionTitle: React.CSSProperties = { fontFamily: "var(--font-cormorant), serif", fontSize: 20, fontWeight: 600, color: "#1A1916", margin: "0 0 14px" }

function activeInMonth(c: Contract, m: string): boolean {
  if (c.status !== "active") return false
  if (c.start > m) return false
  if (c.type === "oneoff") return c.start === m
  if (c.contractedThrough && m > c.contractedThrough) return false
  return true
}

export default function AccountDetailClient(props: Props) {
  const fmt = useFmtCurrency()
  const { clientId, clientSlug, clientName, minHourlyRate, account, allAccounts, people } = props

  const [contracts, setContracts] = useState<Contract[]>(props.contracts)
  const [pulses, setPulses] = useState<Pulse[]>(props.pulses)
  const [members, setMembers] = useState<Member[]>(props.members)
  const [notes, setNotes] = useState<Note[]>(props.notes)
  const [ownerId, setOwnerId] = useState<string | null>(account.ownerId)
  const [savingOwner, setSavingOwner] = useState(false)

  const internal = people.filter(p => !p.isExternal)
  const personName = (id: string | null) => (id ? people.find(p => p.id === id)?.name ?? "—" : "—")

  const months = Array.from({ length: GRID_MONTHS }, (_, i) => ymAdd(now, -(GRID_MONTHS - 1 - i)))
  const prevMonth = ymAdd(now, -1)

  const pulseFor = (contractId: string, m: string) => pulses.find(p => p.contractId === contractId && p.month === m)
  const paymentIn = (m: string) => props.payments.filter(p => p.month === m).reduce((s, p) => s + p.amount, 0)
  const hoursIn = (m: string) => props.hours.filter(h => h.month === m).reduce((s, h) => s + h.hours, 0)
  const budgetIn = (m: string) => contracts.filter(c => activeInMonth(c, m) && c.type !== "oneoff").reduce((s, c) => s + c.hoursPerMonth, 0)
  const rollupPulse = (m: string): Pulse | undefined => {
    const scored = contracts.filter(c => activeInMonth(c, m)).map(c => pulseFor(c.id, m)).filter((p): p is Pulse => !!p)
    return scored.sort((a, b) => a.score - b.score)[0]
  }

  // Snapshot metrics
  const activeContracts = contracts.filter(c => c.status === "active")
  const mrr = activeContracts.filter(c => c.type !== "oneoff" && activeInMonth(c, now)).reduce((s, c) => s + c.monthly, 0)
  const ltv = props.payments.reduce((s, p) => s + p.amount, 0)
  const currentPulse = rollupPulse(now)

  // Over-delivery this month (unpaid hours × min rate), matching the Yield view.
  const hasMin = minHourlyRate != null && minHourlyRate > 0
  const overDelivery = hasMin
    ? contracts.filter(c => activeInMonth(c, now)).reduce((s, c) => {
        const sold = c.monthly / (minHourlyRate as number)
        const actual = props.hours.find(h => h.contractId === c.id && h.month === now)?.hours ?? 0
        return s + Math.max(0, actual - sold) * (minHourlyRate as number)
      }, 0)
    : 0

  // Tenure — earliest project start to now.
  const earliestStart = contracts.length ? contracts.map(c => c.start).sort()[0] : null
  const tenureMonths = earliestStart ? ymDiff(now, earliestStart) + 1 : 0
  const tenureLabel = tenureMonths >= 12
    ? `${Math.floor(tenureMonths / 12)}y ${tenureMonths % 12}m`
    : `${tenureMonths} mo`

  // Churn-risk signals
  const risks: string[] = []
  if (currentPulse && currentPulse.score <= 2) risks.push(`Pulse at ${currentPulse.score}/5`)
  for (const c of activeContracts) {
    const cur = pulseFor(c.id, now), prev = pulseFor(c.id, prevMonth)
    if (cur && prev && cur.score < prev.score) { risks.push(`${c.name} pulse dropped ${prev.score}→${cur.score}`); break }
  }
  if (budgetIn(now) > 0 && hoursIn(now) > budgetIn(now)) risks.push(`Over hours budget this month (${Math.round(hoursIn(now))}h vs ${Math.round(budgetIn(now))}h)`)
  const lastPaid = props.payments.map(p => p.month).sort().slice(-1)[0]
  if (mrr > 0 && lastPaid && lastPaid < prevMonth) risks.push(`No payment recorded since ${ymLabel(lastPaid)}`)

  const defaultOwnerId = ownerId ?? activeContracts.find(c => c.ownerId)?.ownerId ?? null
  const usingProjectOwner = !ownerId && !!defaultOwnerId

  async function saveOwner(next: string | null) {
    setOwnerId(next)
    setSavingOwner(true)
    await fetch(`/api/clients/${clientId}/accounts/${account.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerId: next }),
    })
    setSavingOwner(false)
  }

  function onPulseSaved(p: Pulse) {
    setPulses(prev => [...prev.filter(x => !(x.contractId === p.contractId && x.month === p.month)), p])
  }

  // ── Reassign ───────────────────────────────────────────
  const [reassigning, setReassigning] = useState<string | null>(null)
  async function reassign(contractId: string, toAccountId: string | null) {
    await fetch(`/api/contracts/${contractId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: toAccountId }),
    })
    setContracts(prev => prev.filter(c => c.id !== contractId)) // it left this account
    setReassigning(null)
  }

  // ── Add project ────────────────────────────────────────
  const [addingProject, setAddingProject] = useState(false)
  const [projForm, setProjForm] = useState({ name: "", type: "retainer" as "retainer" | "ongoing" | "oneoff", monthly: "", status: "active", start: now, contractedThrough: "" })
  const [projSaving, setProjSaving] = useState(false)
  async function addProject(e: React.FormEvent) {
    e.preventDefault()
    setProjSaving(true)
    const isOngoing = projForm.type === "ongoing"
    const res = await fetch(`/api/clients/${clientId}/contracts`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: projForm.name.trim(),
        type: isOngoing ? "retainer" : projForm.type,
        monthly: parseFloat(projForm.monthly) || 0,
        status: projForm.status,
        start: projForm.start,
        contractedThrough: isOngoing ? null : projForm.type === "oneoff" ? projForm.start : projForm.contractedThrough || null,
        accountId: account.id,
      }),
    })
    setProjSaving(false)
    if (!res.ok) return
    const c = await res.json()
    setContracts(prev => [...prev, { id: c.id, name: c.name, monthly: c.monthly, hoursPerMonth: c.hoursPerMonth, start: c.start, contractedThrough: c.contractedThrough ?? null, status: c.status, type: c.type, ownerId: c.ownerId ?? null }])
    setAddingProject(false)
    setProjForm({ name: "", type: "retainer", monthly: "", status: "active", start: now, contractedThrough: "" })
  }

  // ── Project owner ──────────────────────────────────────
  async function setProjectOwner(contractId: string, personId: string | null) {
    setContracts(prev => prev.map(c => c.id === contractId ? { ...c, ownerId: personId } : c))
    await fetch(`/api/contracts/${contractId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerId: personId }),
    })
  }

  // ── Team / members ─────────────────────────────────────
  const [addMemberFor, setAddMemberFor] = useState<string | null>(null)
  const [memberForm, setMemberForm] = useState({ personId: "", role: "" })
  async function addMember(e: React.FormEvent, contractId: string) {
    e.preventDefault()
    if (!memberForm.personId) return
    const res = await fetch(`/api/contracts/${contractId}/members`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personId: memberForm.personId, role: memberForm.role.trim() || undefined }),
    })
    if (!res.ok) return
    setMembers(prev => [...prev.filter(m => !(m.contractId === contractId && m.personId === memberForm.personId)), { contractId, personId: memberForm.personId, role: memberForm.role.trim() || null }])
    setAddMemberFor(null)
    setMemberForm({ personId: "", role: "" })
  }
  async function removeMember(contractId: string, personId: string) {
    await fetch(`/api/contracts/${contractId}/members?personId=${personId}`, { method: "DELETE" })
    setMembers(prev => prev.filter(m => !(m.contractId === contractId && m.personId === personId)))
  }

  // ── Notes ──────────────────────────────────────────────
  const [noteText, setNoteText] = useState("")
  const [noteSaving, setNoteSaving] = useState(false)
  async function addNote(e: React.FormEvent) {
    e.preventDefault()
    if (!noteText.trim()) return
    setNoteSaving(true)
    const res = await fetch(`/api/clients/${clientId}/accounts/${account.id}/notes`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: noteText.trim() }),
    })
    setNoteSaving(false)
    if (!res.ok) return
    const n = await res.json()
    setNotes(prev => [{ id: n.id, body: n.body, author: n.author ?? null, createdAt: n.createdAt }, ...prev])
    setNoteText("")
  }
  async function deleteNote(noteId: string) {
    await fetch(`/api/clients/${clientId}/accounts/${account.id}/notes?noteId=${noteId}`, { method: "DELETE" })
    setNotes(prev => prev.filter(n => n.id !== noteId))
  }

  const activeProjects = contracts.filter(c => c.status === "active")
  const pastProjects = contracts.filter(c => c.status !== "active")

  const reassignSelect = (contractId: string) => (
    <select autoFocus defaultValue={account.id}
      onBlur={e => reassign(contractId, e.target.value === account.id ? null : e.target.value || null)}
      onChange={e => reassign(contractId, e.target.value === account.id ? null : e.target.value || null)}
      style={{ fontSize: 11, border: "1px solid #ECE7DE", borderRadius: 4, padding: "2px 6px", color: "#1A1916", background: "#fff", outline: "none" }}>
      <option value="">— Unassign —</option>
      {allAccounts.map(a => <option key={a.id} value={a.id}>{a.name}{a.id === account.id ? " (here)" : ""}</option>)}
    </select>
  )

  const tiles: { label: string; value: string; sub?: string; fg?: string; bg?: string }[] = [
    { label: "Active MRR", value: fmt(mrr), sub: `${activeProjects.length} active project${activeProjects.length !== 1 ? "s" : ""}` },
    currentPulse
      ? { label: "Pulse (lowest active)", value: `${currentPulse.score}/5`, sub: ymLabel(now), fg: pulseColor(currentPulse.score).fg, bg: pulseColor(currentPulse.score).bg }
      : { label: "Pulse (lowest active)", value: "—", sub: "not logged" },
    { label: "Lifetime Value", value: fmt(ltv), sub: "payments to date" },
    { label: "Lost to Over-delivery", value: hasMin ? fmt(overDelivery) : "—", sub: hasMin ? ymLabel(now) : "set min $/hr in Goals" },
  ]

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <style>{`
        @media (max-width: 720px) {
          .acct-tiles { grid-template-columns: 1fr 1fr !important; }
          .acct-proj-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>

      {/* Breadcrumb */}
      <div style={{ fontSize: 12, color: "#9C9590" }}>
        <Link href={`/clients/${clientSlug}/accounts`} style={{ color: "#9C9590", textDecoration: "none" }}>← {clientName} · Accounts</Link>
      </div>

      {/* Header */}
      <div style={{ ...card, display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 20 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 30, fontWeight: 700, color: "#1A1916", margin: "0 0 6px" }}>{account.name}</h1>
          <div style={{ fontSize: 13, color: "#6B6760" }}>
            {account.contactName}
            {account.contactName && account.contactEmail && " · "}
            {account.contactEmail && <a href={`mailto:${account.contactEmail}`} style={{ color: "#6B6760" }}>{account.contactEmail}</a>}
            {!account.contactName && !account.contactEmail && <span style={{ color: "#9C9590" }}>No contact set</span>}
          </div>
        </div>
        <div>
          <label style={label}>Account Owner {usingProjectOwner && <span style={{ color: "#C0BAB2", fontWeight: 400 }}>(from project)</span>}</label>
          <select value={ownerId ?? (usingProjectOwner ? "" : "")} onChange={e => saveOwner(e.target.value || null)}
            style={{ ...input, width: 180, opacity: savingOwner ? 0.6 : 1 }}>
            <option value="">{defaultOwnerId ? `${personName(defaultOwnerId)} (default)` : "— Unassigned —"}</option>
            {internal.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#6B6760" }}>Tenure</div>
          <div style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 22, fontWeight: 600, color: "#1A1916" }}>{earliestStart ? tenureLabel : "—"}</div>
          {earliestStart && <div style={{ fontSize: 11, color: "#9C9590" }}>since {ymLabel(earliestStart)}</div>}
        </div>
      </div>

      {/* Churn banner */}
      {risks.length > 0 && (
        <div style={{ background: "#FBEAE4", border: "1px solid #F3C4B4", borderRadius: 12, padding: "14px 18px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#B23A1B", marginBottom: 4 }}>⚠ Churn risk</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#8A4A38" }}>
            {risks.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}

      {/* Snapshot tiles */}
      <div className="acct-tiles" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {tiles.map((t, i) => (
          <div key={i} style={{ ...card, padding: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9C9590" }}>{t.label}</div>
            <div style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 26, fontWeight: 700, margin: "4px 0 2px", color: t.fg ?? "#1A1916", display: "inline-block", ...(t.bg ? { background: t.bg, borderRadius: 8, padding: "0 10px" } : {}) }}>{t.value}</div>
            {t.sub && <div style={{ fontSize: 11, color: "#9C9590" }}>{t.sub}</div>}
          </div>
        ))}
      </div>

      {/* By-month grid */}
      <div style={card}>
        <h2 style={sectionTitle}>By Month</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 520, fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "6px 10px", fontSize: 11, fontWeight: 700, color: "#9C9590", textTransform: "uppercase", letterSpacing: "0.04em" }}></th>
                {months.map(m => (
                  <th key={m} style={{ textAlign: "right", padding: "6px 10px", fontSize: 11, fontWeight: 700, color: m === now ? "#1A1916" : "#9C9590", whiteSpace: "nowrap" }}>{ymLabel(m)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderTop: "1px solid #F5F1EC" }}>
                <td style={{ padding: "9px 10px", fontWeight: 600, color: "#6B6760" }}>Payments</td>
                {months.map(m => {
                  const v = paymentIn(m)
                  return <td key={m} style={{ padding: "9px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: v ? "#1A1916" : "#C0BAB2" }}>{v ? fmt(v) : "—"}</td>
                })}
              </tr>
              <tr style={{ borderTop: "1px solid #F5F1EC" }}>
                <td style={{ padding: "9px 10px", fontWeight: 600, color: "#6B6760" }}>Pulse</td>
                {months.map(m => {
                  const p = rollupPulse(m)
                  if (!p) return <td key={m} style={{ padding: "9px 10px", textAlign: "right", color: "#C0BAB2" }}>—</td>
                  const col = pulseColor(p.score)
                  return <td key={m} style={{ padding: "9px 10px", textAlign: "right" }}>
                    <span style={{ background: col.bg, color: col.fg, borderRadius: 20, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>{p.score}/5</span>
                  </td>
                })}
              </tr>
              <tr style={{ borderTop: "1px solid #F5F1EC" }}>
                <td style={{ padding: "9px 10px", fontWeight: 600, color: "#6B6760" }}>Hours</td>
                {months.map(m => {
                  const a = hoursIn(m), b = budgetIn(m)
                  const over = b > 0 && a > b
                  if (!a && !b) return <td key={m} style={{ padding: "9px 10px", textAlign: "right", color: "#C0BAB2" }}>—</td>
                  return <td key={m} style={{ padding: "9px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: over ? "#C2410C" : "#1A1916", whiteSpace: "nowrap" }}>
                    {over && <span style={{ fontSize: 10 }}>▲ </span>}
                    {a ? `${Math.round(a)}` : "0"}{b > 0 && <span style={{ color: "#9C9590", fontWeight: 400 }}> / {Math.round(b)}h</span>}
                  </td>
                })}
              </tr>
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 11, color: "#9C9590", marginTop: 10 }}>Account-level totals across all projects. Hours show actual vs budget — <span style={{ color: "#C2410C" }}>▲ over</span>. Log hours in Reconciliation.</div>
      </div>

      {/* Projects */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h2 style={{ ...sectionTitle, margin: 0 }}>Projects</h2>
          <button onClick={() => setAddingProject(a => !a)} style={{ padding: "6px 14px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>+ Add Project</button>
        </div>

        {addingProject && (
          <form onSubmit={addProject} style={{ background: "#FBFAF7", border: "1px solid #ECE7DE", borderRadius: 8, padding: 14, marginBottom: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="acct-proj-grid" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 8 }}>
              <div><label style={label}>Project Name</label><input style={{ ...input, fontSize: 12 }} value={projForm.name} onChange={e => setProjForm(f => ({ ...f, name: e.target.value }))} required autoFocus placeholder="Retainer" /></div>
              <div><label style={label}>Type</label>
                <select style={{ ...input, fontSize: 12 }} value={projForm.type} onChange={e => setProjForm(f => ({ ...f, type: e.target.value as "retainer" | "ongoing" | "oneoff" }))}>
                  <option value="retainer">Retainer – End Date</option>
                  <option value="ongoing">Retainer – Ongoing</option>
                  <option value="oneoff">One-off</option>
                </select>
              </div>
              <div><label style={label}>{projForm.type === "oneoff" ? "Amount ($)" : "Monthly ($)"}</label><input style={{ ...input, fontSize: 12 }} type="number" value={projForm.monthly} onChange={e => setProjForm(f => ({ ...f, monthly: e.target.value }))} required min={0} placeholder="2500" /></div>
              <div><label style={label}>Status</label>
                <select style={{ ...input, fontSize: 12 }} value={projForm.status} onChange={e => setProjForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="active">Active</option>
                  <option value="potential">Qualified</option>
                  <option value="finished">Finished</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <div><label style={label}>{projForm.type === "oneoff" ? "Month" : "Start"}</label><input style={{ ...input, fontSize: 12, width: 150 }} type="month" value={projForm.start} onChange={e => setProjForm(f => ({ ...f, start: e.target.value }))} required /></div>
              {projForm.type === "retainer" && <div><label style={label}>Through</label><input style={{ ...input, fontSize: 12, width: 150 }} type="month" value={projForm.contractedThrough} onChange={e => setProjForm(f => ({ ...f, contractedThrough: e.target.value }))} required /></div>}
              <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                <button type="button" onClick={() => setAddingProject(false)} style={{ padding: "6px 12px", background: "none", border: "1px solid #ECE7DE", borderRadius: 5, fontSize: 12, cursor: "pointer", color: "#6B6760" }}>Cancel</button>
                <button type="submit" disabled={projSaving} style={{ padding: "6px 14px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{projSaving ? "Saving…" : "Add Project"}</button>
              </div>
            </div>
          </form>
        )}

        {contracts.length === 0 ? (
          <div style={{ color: "#9C9590", fontSize: 13, padding: "16px 0" }}>No projects on this account yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[["Active", activeProjects], ["Past / Pipeline", pastProjects]].map(([heading, list]) => {
              const items = list as Contract[]
              if (!items.length) return null
              return (
                <div key={heading as string}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#9C9590", textTransform: "uppercase", letterSpacing: "0.05em", margin: "8px 0 4px" }}>{heading as string}</div>
                  {items.map(c => (
                    <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 0", borderBottom: "1px solid #F5F1EC" }}>
                      <span style={{ fontWeight: 500, color: "#1A1916" }}>{c.name}</span>
                      <span style={{ fontSize: 12, color: "#9C9590" }}>
                        {c.type === "oneoff" ? ymLabel(c.start) : c.contractedThrough ? `${ymLabel(c.start)} – ${ymLabel(c.contractedThrough)}` : `${ymLabel(c.start)} – Ongoing`}
                      </span>
                      <span style={{ fontSize: 12, color: "#6B6760", fontVariantNumeric: "tabular-nums" }}>{fmt(c.monthly)}{c.type === "retainer" || c.type === "ongoing" ? "/mo" : ""}</span>
                      <span style={{ flex: 1 }} />
                      {c.status === "active" && <ProjectPulse contractId={c.id} current={pulseFor(c.id, now)} prev={pulseFor(c.id, prevMonth)} onSaved={onPulseSaved} />}
                      {reassigning === c.id ? reassignSelect(c.id)
                        : <button onClick={() => setReassigning(c.id)} style={{ background: "none", border: "1px solid #ECE7DE", borderRadius: 4, fontSize: 11, color: "#9C9590", cursor: "pointer", padding: "2px 8px" }}>Reassign</button>}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Team */}
      <div style={card}>
        <h2 style={sectionTitle}>Team</h2>
        {activeProjects.length === 0 ? (
          <div style={{ color: "#9C9590", fontSize: 13 }}>No active projects to staff.</div>
        ) : activeProjects.map(c => {
          const projMembers = members.filter(m => m.contractId === c.id)
          return (
            <div key={c.id} style={{ padding: "10px 0", borderBottom: "1px solid #F5F1EC" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                <span style={{ fontWeight: 600, color: "#1A1916", fontSize: 13 }}>{c.name}</span>
                <span style={{ fontSize: 11, color: "#9C9590" }}>Owner:</span>
                <select value={c.ownerId ?? ""} onChange={e => setProjectOwner(c.id, e.target.value || null)}
                  style={{ fontSize: 12, border: "1px solid #ECE7DE", borderRadius: 5, padding: "2px 6px", color: "#1A1916", background: "#fff", outline: "none" }}>
                  <option value="">— Unassigned —</option>
                  {internal.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <span style={{ flex: 1 }} />
                <button onClick={() => { setAddMemberFor(x => x === c.id ? null : c.id); setMemberForm({ personId: "", role: "" }) }}
                  style={{ background: "none", border: "1px solid #E9532A", borderRadius: 4, fontSize: 11, color: "#E9532A", cursor: "pointer", padding: "2px 8px", fontWeight: 600 }}>+ Person / Vendor</button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {projMembers.length === 0 && <span style={{ fontSize: 12, color: "#C0BAB2" }}>No additional team assigned.</span>}
                {projMembers.map(m => {
                  const p = people.find(pp => pp.id === m.personId)
                  return (
                    <span key={m.personId} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#FBFAF7", border: "1px solid #ECE7DE", borderRadius: 20, padding: "3px 6px 3px 11px", fontSize: 12 }}>
                      <span style={{ color: "#1A1916", fontWeight: 500 }}>{p?.name ?? "—"}</span>
                      {p?.isExternal && <span style={{ fontSize: 9, fontWeight: 700, color: "#B45309", background: "#FEF3C7", borderRadius: 4, padding: "1px 4px" }}>VENDOR</span>}
                      {m.role && <span style={{ color: "#9C9590" }}>· {m.role}</span>}
                      <button onClick={() => removeMember(c.id, m.personId)} style={{ background: "none", border: "none", color: "#C0BAB2", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "0 2px" }}>×</button>
                    </span>
                  )
                })}
              </div>
              {addMemberFor === c.id && (
                <form onSubmit={e => addMember(e, c.id)} style={{ display: "flex", gap: 8, alignItems: "flex-end", marginTop: 10, flexWrap: "wrap" }}>
                  <div><label style={label}>Person / Vendor</label>
                    <select value={memberForm.personId} onChange={e => setMemberForm(f => ({ ...f, personId: e.target.value }))} required style={{ ...input, fontSize: 12, width: 200 }}>
                      <option value="">— Select —</option>
                      {people.map(p => <option key={p.id} value={p.id}>{p.name}{p.isExternal ? " (vendor)" : ""}</option>)}
                    </select>
                  </div>
                  <div><label style={label}>Title on project</label><input style={{ ...input, fontSize: 12, width: 170 }} value={memberForm.role} onChange={e => setMemberForm(f => ({ ...f, role: e.target.value }))} placeholder="Content Writer" /></div>
                  <button type="submit" style={{ padding: "7px 14px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Add</button>
                  <button type="button" onClick={() => setAddMemberFor(null)} style={{ padding: "7px 10px", background: "none", border: "1px solid #ECE7DE", borderRadius: 5, fontSize: 12, cursor: "pointer", color: "#6B6760" }}>Cancel</button>
                </form>
              )}
            </div>
          )
        })}
      </div>

      {/* Notes */}
      <div style={card}>
        <h2 style={sectionTitle}>Notes</h2>
        <form onSubmit={addNote} style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <input value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add a note…" style={{ ...input, flex: 1 }} />
          <button type="submit" disabled={noteSaving || !noteText.trim()} style={{ padding: "8px 16px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: noteSaving || !noteText.trim() ? 0.5 : 1 }}>{noteSaving ? "…" : "Add"}</button>
        </form>
        {notes.length === 0 ? (
          <div style={{ color: "#9C9590", fontSize: 13 }}>No notes yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {notes.map(n => (
              <div key={n.id} style={{ borderLeft: "2px solid #ECE7DE", paddingLeft: 12 }}>
                <div style={{ fontSize: 13, color: "#1A1916", whiteSpace: "pre-wrap" }}>{n.body}</div>
                <div style={{ fontSize: 11, color: "#9C9590", marginTop: 2, display: "flex", gap: 8, alignItems: "center" }}>
                  <span>{new Date(n.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                  {n.author && <span>· {n.author}</span>}
                  <button onClick={() => deleteNote(n.id)} style={{ background: "none", border: "none", color: "#C0BAB2", cursor: "pointer", fontSize: 11, padding: 0, textDecoration: "underline" }}>delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
