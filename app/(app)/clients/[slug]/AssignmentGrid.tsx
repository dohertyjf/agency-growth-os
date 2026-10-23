"use client"
import { useState } from "react"
import Link from "next/link"

// Who's on what: active projects down the side, internal team across the top.
// Click a cell to put someone on a project (or take them off); pick the owner
// per row. Same saves as the project page — ProjectMember rows and ownerId.

// "Matt Bryant" → "Matt B", so two Matts stay distinguishable in the header.
function shortName(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}` : parts[0]
}

interface Project { id: string; name: string; status: string; ownerId?: string | null }
interface Person { id: string; name: string; isExternal: boolean; endDate: string | null }
interface Member { contractId: string; personId: string }

export default function AssignmentGrid({ clientSlug, contracts, people, members, onOwnerChange, onMembersChange }: {
  clientSlug: string
  contracts: Project[]
  people: Person[]
  members: Member[]
  onOwnerChange: (contractId: string, ownerId: string | null) => void
  onMembersChange: (next: Member[]) => void
}) {
  const [saving, setSaving] = useState<string | null>(null)
  const today = new Date().toISOString().slice(0, 10)

  const projects = contracts.filter(c => c.status === "active").sort((a, b) => a.name.localeCompare(b.name))
  const team = people.filter(p => !p.isExternal && !(p.endDate && p.endDate < today))
  if (projects.length === 0 || team.length === 0) {
    return (
      <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 20, fontSize: 13, color: "#9C9590" }}>
        {team.length === 0 ? "Add your team first, then assign them to projects here." : "No active projects to assign yet."}
      </div>
    )
  }

  const isMember = (cId: string, pId: string) => members.some(m => m.contractId === cId && m.personId === pId)
  const onProject = (c: Project, pId: string) => c.ownerId === pId || isMember(c.id, pId)
  const unowned = projects.filter(c => !c.ownerId).length

  async function toggle(c: Project, personId: string) {
    const key = c.id + personId
    if (saving) return
    setSaving(key)
    const on = isMember(c.id, personId)
    const res = on
      ? await fetch(`/api/contracts/${c.id}/members?personId=${encodeURIComponent(personId)}`, { method: "DELETE" }).catch(() => null)
      : await fetch(`/api/contracts/${c.id}/members`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ personId }) }).catch(() => null)
    setSaving(null)
    if (!res?.ok) return
    onMembersChange(on
      ? members.filter(m => !(m.contractId === c.id && m.personId === personId))
      : [...members, { contractId: c.id, personId }])
  }

  const th: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "#9C9590", padding: "4px 6px", borderBottom: "1px solid #ECE7DE", whiteSpace: "nowrap" }
  const sticky: React.CSSProperties = { position: "sticky", left: 0, background: "#fff", zIndex: 1 }

  return (
    <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1A1916" }}>Project Assignments</div>
          <div style={{ fontSize: 11, color: "#9C9590", marginTop: 2 }}>
            Click a cell to put someone on a project. Logging hours on a project assigns them automatically.
          </div>
        </div>
        {unowned > 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, color: "#B45309", background: "#FEF3C7", borderRadius: 20, padding: "3px 10px", whiteSpace: "nowrap" }}>
            {unowned} without an owner
          </span>
        )}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={{ ...th, ...sticky, textAlign: "left", minWidth: 170 }}>Project</th>
              <th style={{ ...th, textAlign: "left" }}>Owner</th>
              {team.map(p => <th key={p.id} title={p.name} style={{ ...th, textAlign: "center" }}>{shortName(p.name)}</th>)}
            </tr>
          </thead>
          <tbody>
            {projects.map(c => (
              <tr key={c.id}>
                <td style={{ ...sticky, padding: "6px 6px", borderBottom: "1px solid #F5F1EC", fontSize: 13 }}>
                  <Link href={`/clients/${clientSlug}/projects/${c.id}`} style={{ color: "#1A1916", textDecoration: "none" }}>{c.name}</Link>
                </td>
                <td style={{ padding: "6px 6px", borderBottom: "1px solid #F5F1EC" }}>
                  <select value={c.ownerId ?? ""} onChange={e => onOwnerChange(c.id, e.target.value || null)}
                    style={{ fontSize: 12, border: `1px solid ${c.ownerId ? "#ECE7DE" : "#FCD34D"}`, borderRadius: 5, padding: "3px 6px", background: c.ownerId ? "#fff" : "#FFFBEB", color: c.ownerId ? "#1A1916" : "#B45309", fontFamily: "inherit", cursor: "pointer", maxWidth: 150 }}>
                    <option value="">No owner</option>
                    {team.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </td>
                {team.map(p => {
                  const owner = c.ownerId === p.id
                  const on = onProject(c, p.id)
                  const busy = saving === c.id + p.id
                  return (
                    <td key={p.id} style={{ padding: "4px 6px", borderBottom: "1px solid #F5F1EC", textAlign: "center" }}>
                      <button
                        onClick={() => !owner && toggle(c, p.id)}
                        title={owner ? `${p.name} owns this — change the owner to reassign` : on ? `Take ${p.name} off ${c.name}` : `Put ${p.name} on ${c.name}`}
                        aria-label={`${p.name} on ${c.name}`} aria-pressed={on}
                        style={{
                          width: 26, height: 22, borderRadius: 5, fontSize: 11, fontWeight: 700, lineHeight: 1,
                          border: on ? "none" : "1.5px solid #E6DED2", cursor: owner ? "default" : "pointer",
                          background: owner ? "#E9532A" : on ? "#1F7A4D" : "#fff", color: "#fff", opacity: busy ? 0.5 : 1,
                        }}>
                        {owner ? "★" : on ? "✓" : ""}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ ...sticky, padding: "8px 6px", fontSize: 11, color: "#9C9590" }}>Projects each</td>
              <td />
              {team.map(p => (
                <td key={p.id} style={{ padding: "8px 6px", textAlign: "center", fontSize: 12, fontWeight: 700, color: "#1A1916", fontVariantNumeric: "tabular-nums" }}>
                  {projects.filter(c => onProject(c, p.id)).length}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 11, color: "#9C9590" }}>
        <span><span style={{ color: "#E9532A", fontWeight: 700 }}>★</span> Owner</span>
        <span><span style={{ color: "#1F7A4D", fontWeight: 700 }}>✓</span> On the project</span>
      </div>
    </div>
  )
}
