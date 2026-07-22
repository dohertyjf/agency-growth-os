"use client"
import { useState } from "react"
import Link from "next/link"
import Dashboard from "@/components/Dashboard"
import ContractsPanel from "./ContractsPanel"

interface Metric {
  id: string
  clientId: string
  month: string
  revenue: number
  totalExpenses: number
  salaries: number
  software: number
  cashInBank: number
  leads: number
  newClients: number
  closeRate: number
  churn: number
}

interface Contract {
  id: string
  name: string
  monthly: number
  start: string
  contractedThrough: string
  status: string
}

interface Goal {
  annualRevenue: number
  profit: number
}

interface Props {
  clientId: string
  clientName: string
  initialStatus: "potential" | "active" | "paused"
  initialStartDate: string | null
  initialEndDate: string | null
  metrics: Metric[]
  initialContracts: Contract[]
  goal: Goal | null
}

export default function ClientPageClient({
  clientId, clientName, initialStatus, initialStartDate, initialEndDate,
  metrics, initialContracts, goal,
}: Props) {
  const [contracts, setContracts] = useState<Contract[]>(initialContracts)

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <Link href="/clients" style={{ fontSize: 13, color: "#9C9590", textDecoration: "none" }}>← Clients</Link>
      </div>
      <Dashboard
        clientId={clientId}
        clientName={clientName}
        metrics={metrics}
        contracts={contracts}
        goal={goal}
        initialStatus={initialStatus}
        initialStartDate={initialStartDate}
        initialEndDate={initialEndDate}
      />
      <div style={{ marginTop: 32 }}>
        <ContractsPanel
          clientId={clientId}
          initialContracts={initialContracts}
          onContractsChange={setContracts}
        />
      </div>
    </div>
  )
}
