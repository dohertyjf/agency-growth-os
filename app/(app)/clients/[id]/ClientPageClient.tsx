"use client"
import { useState } from "react"
import Link from "next/link"
import Dashboard from "@/components/Dashboard"
import ContractsPanel from "./ContractsPanel"
import ReconciliationTable from "./ReconciliationTable"
import AccountsPanel from "./AccountsPanel"
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
  accountId?: string | null
}

interface Account {
  id: string
  name: string
  notes?: string | null
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
  initialAccounts: Account[]
  initialAccountMonths: AccountMonth[]
  initialPayments: Payment[]
  goal: Goal | null
}

type Tab = "overview" | "accounts" | "projects" | "reconciliation"

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "accounts", label: "Accounts" },
  { key: "projects", label: "Projects" },
  { key: "reconciliation", label: "Reconciliation" },
]

export default function ClientPageClient({
  clientId, clientName, initialStatus, initialStartDate, initialEndDate,
  metrics: initialMetrics, initialContracts, initialAccounts, initialAccountMonths, initialPayments, goal,
}: Props) {
  const [tab, setTab] = useState<Tab>("overview")
  const [contracts, setContracts] = useState<Contract[]>(initialContracts)
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts)
  const [metrics, setMetrics] = useState<Metric[]>(initialMetrics)
  const [payments, setPayments] = useState<Payment[]>(initialPayments)

  function handleRevenueUpdate(month: string, revenue: number) {
    setMetrics(prev => {
      const exists = prev.find(m => m.month === month)
      if (exists) return prev.map(m => m.month === month ? { ...m, revenue } : m)
      return [...prev, { id: "", clientId, month, revenue, totalExpenses: 0, salaries: 0, software: 0, cashInBank: 0, leads: 0, newClients: 0, closeRate: 0, churn: 0 }]
    })
  }

  function handleContractAccountChange(contractId: string, accountId: string | null) {
    setContracts(prev => prev.map(c => c.id === contractId ? { ...c, accountId } : c))
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <Link href="/clients" style={{ fontSize: 13, color: "#9C9590", textDecoration: "none" }}>← Clients</Link>
        <AddClientModal />
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 2, marginBottom: 24, borderBottom: "2px solid #ECE7DE" }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "8px 20px",
              fontSize: 13,
              fontWeight: 600,
              border: "none",
              borderBottom: tab === t.key ? "2px solid #E9532A" : "2px solid transparent",
              marginBottom: -2,
              background: "none",
              color: tab === t.key ? "#E9532A" : "#9C9590",
              cursor: "pointer",
              transition: "color 0.15s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
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
      )}

      {tab === "accounts" && (
        <AccountsPanel
          clientId={clientId}
          initialAccounts={accounts}
          contracts={contracts}
          onAccountsChange={setAccounts}
          onContractAccountChange={handleContractAccountChange}
        />
      )}

      {tab === "projects" && (
        <ContractsPanel
          clientId={clientId}
          initialContracts={initialContracts}
          accounts={accounts}
          onContractsChange={updated => setContracts(updated)}
        />
      )}

      {tab === "reconciliation" && (
        <ReconciliationTable
          contracts={contracts}
          initialAccountMonths={initialAccountMonths}
          initialPayments={initialPayments}
          onRevenueUpdate={handleRevenueUpdate}
          onPaymentsChange={setPayments}
        />
      )}
    </div>
  )
}
