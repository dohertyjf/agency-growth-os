"use client"
import { useState } from "react"
import Link from "next/link"
import Dashboard from "@/components/Dashboard"
import ContractsPanel from "./ContractsPanel"
import ReconciliationTable from "./ReconciliationTable"
import AddClientModal from "../AddClientModal"

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
  type: string
}

interface AccountMonth {
  contractId: string
  month: string
  actual: number
}

interface Payment {
  contractId: string
  month: string
  amount: number
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
  initialAccountMonths: AccountMonth[]
  initialPayments: Payment[]
  goal: Goal | null
}

export default function ClientPageClient({
  clientId, clientName, initialStatus, initialStartDate, initialEndDate,
  metrics: initialMetrics, initialContracts, initialAccountMonths, initialPayments, goal,
}: Props) {
  const [contracts, setContracts] = useState<Contract[]>(initialContracts)
  const [metrics, setMetrics] = useState<Metric[]>(initialMetrics)
  const [payments, setPayments] = useState<Payment[]>(initialPayments)

  function handleRevenueUpdate(month: string, revenue: number) {
    setMetrics(prev => {
      const exists = prev.find(m => m.month === month)
      if (exists) return prev.map(m => m.month === month ? { ...m, revenue } : m)
      return [...prev, { id: "", clientId, month, revenue, totalExpenses: 0, salaries: 0, software: 0, cashInBank: 0, leads: 0, newClients: 0, closeRate: 0, churn: 0 }]
    })
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <Link href="/clients" style={{ fontSize: 13, color: "#9C9590", textDecoration: "none" }}>← Clients</Link>
        <AddClientModal />
      </div>
      <Dashboard
        clientId={clientId}
        clientName={clientName}
        metrics={metrics}
        contracts={contracts}
        goal={goal}
        payments={payments}
        initialStatus={initialStatus}
        initialStartDate={initialStartDate}
        initialEndDate={initialEndDate}
      />
      <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 24 }}>
        <ReconciliationTable
          contracts={contracts}
          initialAccountMonths={initialAccountMonths}
          initialPayments={initialPayments}
          onRevenueUpdate={handleRevenueUpdate}
          onPaymentsChange={setPayments}
        />
        <ContractsPanel
          clientId={clientId}
          initialContracts={initialContracts}
          onContractsChange={setContracts}
        />
      </div>
    </div>
  )
}
