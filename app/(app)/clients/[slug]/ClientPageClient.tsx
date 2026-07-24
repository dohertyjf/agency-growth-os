"use client"
import { useState } from "react"
import Link from "next/link"
import Dashboard from "@/components/Dashboard"
import ContractsPanel from "./ContractsPanel"
import ReconciliationTable from "./ReconciliationTable"
import AccountsPanel from "./AccountsPanel"
import ProductsPanel from "./ProductsPanel"

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
  contactName?: string | null
  contactEmail?: string | null
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

interface Product {
  id: string
  name: string
  description: string | null
  type: "retainer" | "oneoff"
  monthly: number
}

type Tab = "dashboard" | "accounts" | "projects" | "reconciliation" | "progress" | "products"

interface Props {
  clientId: string
  clientSlug: string
  clientName: string
  currentTab: Tab
  initialStatus: "potential" | "active" | "paused"
  initialStartDate: string | null
  initialEndDate: string | null
  metrics: Metric[]
  initialContracts: Contract[]
  initialAccounts: Account[]
  initialAccountMonths: AccountMonth[]
  initialPayments: Payment[]
  goal: Goal | null
  products: Product[]
}

const TABS: { key: Tab; label: string }[] = [
  { key: "dashboard", label: "Overview" },
  { key: "accounts", label: "Accounts" },
  { key: "projects", label: "Projects" },
  { key: "reconciliation", label: "Reconciliation" },
  { key: "progress", label: "Progress" },
  { key: "products", label: "Products" },
]

export default function ClientPageClient({
  clientId, clientSlug, clientName, currentTab,
  initialStatus, initialStartDate, initialEndDate,
  metrics: initialMetrics, initialContracts, initialAccounts, initialAccountMonths, initialPayments, goal, products,
}: Props) {
  const [contracts, setContracts] = useState<Contract[]>(initialContracts)
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts)
  const [metrics, setMetrics] = useState<Metric[]>(initialMetrics)
  const [payments, setPayments] = useState<Payment[]>(initialPayments)
  const [clientProducts, setClientProducts] = useState<Product[]>(products)

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
      <div style={{ marginBottom: 20 }}>
        <Link href="/clients" style={{ fontSize: 13, color: "#9C9590", textDecoration: "none" }}>← Clients</Link>
      </div>

      <div style={{ display: "flex", gap: 2, marginBottom: 24, borderBottom: "2px solid #ECE7DE" }}>
        {TABS.map(t => (
          <Link
            key={t.key}
            href={`/clients/${clientSlug}/${t.key}`}
            style={{
              padding: "8px 20px",
              fontSize: 13,
              fontWeight: 600,
              borderBottom: currentTab === t.key ? "2px solid #E9532A" : "2px solid transparent",
              marginBottom: -2,
              color: currentTab === t.key ? "#E9532A" : "#9C9590",
              textDecoration: "none",
              display: "inline-block",
              transition: "color 0.15s",
            }}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {currentTab === "dashboard" && (
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

      {currentTab === "accounts" && (
        <AccountsPanel
          clientId={clientId}
          initialAccounts={accounts}
          contracts={contracts}
          products={clientProducts}
          onAccountsChange={setAccounts}
          onContractAccountChange={handleContractAccountChange}
          onContractCreated={contract => setContracts(prev => [...prev, contract])}
        />
      )}

      {currentTab === "projects" && (
        <ContractsPanel
          clientId={clientId}
          initialContracts={initialContracts}
          accounts={accounts}
          products={clientProducts}
          onContractsChange={updated => setContracts(updated)}
          onAccountCreated={account => setAccounts(prev => [...prev, account].sort((a, b) => a.name.localeCompare(b.name)))}
        />
      )}

      {currentTab === "reconciliation" && (
        <ReconciliationTable
          contracts={contracts}
          initialAccountMonths={initialAccountMonths}
          initialPayments={initialPayments}
          onRevenueUpdate={handleRevenueUpdate}
          onPaymentsChange={setPayments}
        />
      )}

      {currentTab === "progress" && (
        <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 40, textAlign: "center", color: "#9C9590" }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Progress</div>
          <div style={{ fontSize: 13 }}>Coming soon.</div>
        </div>
      )}

      {currentTab === "products" && (
        <ProductsPanel
          clientId={clientId}
          initialProducts={clientProducts}
          onProductsChange={setClientProducts}
        />
      )}
    </div>
  )
}
