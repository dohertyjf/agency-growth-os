"use client"
import { useState } from "react"
import { currentMRR, type ContractRow } from "@/lib/calc"
import ClientCard from "./ClientCard"

interface Contract {
  monthly: number
  start: string
  contractedThrough: string
  status: string
  type: string
}

interface Metric {
  revenue: number | null
}

interface Client {
  id: string
  name: string
  agency: string | null
  status: string
  contracts: Contract[]
  metrics: Metric[]
}

interface Props {
  clients: Client[]
  now: string
}

const STATUS_ORDER: Record<string, number> = { potential: 0, active: 1, paused: 2 }

export default function ClientsGrid({ clients, now }: Props) {
  const [showPaused, setShowPaused] = useState(false)

  const sorted = [...clients].sort((a, b) => {
    const diff = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99)
    if (diff !== 0) return diff
    return a.name.localeCompare(b.name)
  })

  const visible = showPaused ? sorted : sorted.filter(c => c.status !== "paused")

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#6B6760", cursor: "pointer", userSelect: "none" }}>
          <input
            type="checkbox"
            checked={showPaused}
            onChange={e => setShowPaused(e.target.checked)}
            style={{ cursor: "pointer" }}
          />
          Show paused clients
        </label>
      </div>

      {visible.length === 0 ? (
        <div style={{ color: "#9C9590", fontSize: 14 }}>No clients yet. Add one to get started.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {visible.map(client => {
            const contractRows: ContractRow[] = client.contracts.map(c => ({
              monthly: c.monthly,
              start: c.start,
              contractedThrough: c.contractedThrough,
              status: c.status as "active" | "potential",
              type: (c.type ?? "retainer") as "retainer" | "oneoff",
            }))
            const mrr = currentMRR(contractRows, now)
            const latest = client.metrics[0]
            return (
              <ClientCard
                key={client.id}
                id={client.id}
                name={client.name}
                agency={client.agency}
                status={client.status}
                mrr={mrr}
                latestRevenue={latest?.revenue ?? null}
              />
            )
          })}
        </div>
      )}
    </>
  )
}
