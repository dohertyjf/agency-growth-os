"use client"
import { useState } from "react"
import Link from "next/link"
import { ymAdd, ymLabel } from "@/lib/calc"

interface Item { key: string; label: string; tab: string; hint?: string }

export default function MonthlyChecklist({
  clientId, clientSlug, month, initial, renewalCount, atRiskCount,
}: {
  clientId: string
  clientSlug: string
  month: string
  initial: { dismissed: boolean; checkedKeys: string[] } | null
  renewalCount: number
  atRiskCount: number
}) {
  const [dismissed, setDismissed] = useState(initial?.dismissed ?? false)
  const [checked, setChecked] = useState<Set<string>>(new Set(initial?.checkedKeys ?? []))

  const prevLabel = ymLabel(ymAdd(month, -1))

  const items: Item[] = [
    { key: "numbers", label: `Enter ${prevLabel}'s numbers on the Dashboard`, tab: "dashboard" },
    { key: "reconcile", label: "Reconcile payments — what's collected vs. not", tab: "reconciliation" },
    { key: "hours", label: `Log ${prevLabel}'s hours`, tab: "reconciliation" },
    { key: "pulse", label: "Update Pulse scores for active projects", tab: "projects" },
    { key: "finished", label: "Confirm finished projects (auto-moved — anything look off?)", tab: "projects" },
    { key: "pipeline", label: "Make sure the Pipeline is up to date", tab: "pipeline" },
    { key: "renewals", label: "Check upcoming renewals", tab: "projects", hint: renewalCount > 0 ? `${renewalCount} ending ≤60d` : undefined },
    { key: "atrisk", label: "Review at-risk accounts", tab: "accounts", hint: atRiskCount > 0 ? `${atRiskCount} flagged` : undefined },
  ]

  function persist(body: { dismissed?: boolean; checkedKeys?: string[] }) {
    fetch(`/api/clients/${clientId}/checklist`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, ...body }),
    }).catch(() => {})
  }

  function toggle(key: string) {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      persist({ checkedKeys: [...next] })
      return next
    })
  }

  function dismiss() {
    setDismissed(true)
    persist({ dismissed: true })
  }

  if (dismissed) return null

  const done = items.filter(i => checked.has(i.key)).length
  const allDone = done === items.length

  return (
    <div style={{ background: "#fff", border: "1px solid #E6D9C9", borderLeft: "3px solid #E9532A", borderRadius: 12, padding: "16px 18px", marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 20, fontWeight: 600, color: "#1A1916" }}>
            Monthly Close-Out <span style={{ color: "#9C9590", fontWeight: 400 }}>· wrap up {prevLabel}</span>
          </div>
          <div style={{ fontSize: 11, color: "#9C9590", marginTop: 2 }}>
            {allDone ? "All done — nice work." : `${done} of ${items.length} done`}
          </div>
        </div>
        <button onClick={dismiss} title="Dismiss for this month"
          style={{ background: "none", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 12, color: "#6B6760", cursor: "pointer", padding: "5px 12px", fontWeight: 600, whiteSpace: "nowrap" }}>
          Dismiss
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {items.map(item => {
          const on = checked.has(item.key)
          return (
            <div key={item.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderTop: "1px solid #F5F1EC" }}>
              <button onClick={() => toggle(item.key)} aria-label={on ? "Uncheck" : "Check"}
                style={{ width: 20, height: 20, flexShrink: 0, borderRadius: 5, border: on ? "none" : "1.5px solid #D8CFC2", background: on ? "#1F7A4D" : "#fff", color: "#fff", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
                {on ? "✓" : ""}
              </button>
              <span style={{ flex: 1, fontSize: 13, color: on ? "#9C9590" : "#1A1916", textDecoration: on ? "line-through" : "none" }}>{item.label}</span>
              {item.hint && (
                <span style={{ fontSize: 10, fontWeight: 700, color: "#B45309", background: "#FEF3C7", borderRadius: 20, padding: "2px 9px", whiteSpace: "nowrap" }}>{item.hint}</span>
              )}
              <Link href={`/clients/${clientSlug}/${item.tab}`} style={{ fontSize: 12, color: "#E9532A", textDecoration: "none", fontWeight: 600, whiteSpace: "nowrap" }}>Go →</Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}
