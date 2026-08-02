"use client"
import { useState, useMemo } from "react"
import Link from "next/link"
import Dashboard from "@/components/Dashboard"
import ContractsPanel from "./ContractsPanel"
import ReconciliationTable from "./ReconciliationTable"
import CashflowProjection from "./CashflowProjection"
import AccountsPanel from "./AccountsPanel"
import ProductsPanel from "./ProductsPanel"
import ProgressPanel from "./ProgressPanel"
import GoalsPanel from "./GoalsPanel"
import PeoplePanel from "./PeoplePanel"
import PipelinePanel from "./PipelinePanel"
import CallsClient from "../../calls/CallsClient"
import { CurrencyProvider } from "@/lib/CurrencyContext"

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
  marketingSpend: number
}

interface Contract {
  id: string
  name: string
  monthly: number
  hoursPerMonth: number
  actualHours?: number | null
  start: string
  contractedThrough: string | null
  status: string
  type: string
  accountId?: string | null
  callDate: string | null
  signedDate: string | null
  kickoffDate: string | null
}

interface Person {
  id: string
  name: string
  role: string | null
  responsibilities: string | null
  isExternal: boolean
  isFullTime: boolean
  annualSalary: number
  billableHours: number
  startDate: string | null
  endDate: string | null
}

interface PersonSalaryMonth {
  personId: string
  month: string
  monthlySalary: number
}

interface PersonHoursMonth {
  personId: string
  month: string
  monthlyHours: number
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
  monthlyRevenue: number
  netProfitPct: number
  closeRatePct: number
  peoplePct?: number
  currency?: string
  minHourlyRate?: number | null
}

interface Product {
  id: string
  name: string
  description: string | null
  type: "retainer" | "ongoing" | "oneoff"
  monthly: number
}

interface RoadmapItem {
  key: string
  status: "none" | "red" | "yellow" | "green"
}

interface CallQuestion { id: string; q: string; a: string | null; order: number }
interface Call {
  id: string
  clientId: string
  date: string
  title: string
  transcript: string | null
  video: string | null
  synopsis: string | null
  notes: string | null
  isGroupCall: boolean
  questions: CallQuestion[]
}

type Tab = "dashboard" | "accounts" | "pipeline" | "projects" | "reconciliation" | "progress" | "products" | "goals" | "team" | "calls"

interface Props {
  clientId: string
  projectionState: string | null
  clientSlug: string
  clientName: string
  clientAgency: string | null
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
  initialCalls: Call[]
  products: Product[]
  initialRoadmap: RoadmapItem[]
  initialPeople: Person[]
  initialSalaryMonths: PersonSalaryMonth[]
  initialHoursMonths: PersonHoursMonth[]
}

const TABS: { key: Tab; label: string }[] = [
  { key: "dashboard", label: "Overview" },
  { key: "accounts", label: "Accounts" },
  { key: "projects", label: "Projects" },
  { key: "pipeline", label: "Pipeline" },
  { key: "team", label: "Team" },
  { key: "products", label: "Products" },
  { key: "progress", label: "Progress" },
  { key: "calls", label: "Calls" },
  { key: "goals", label: "Settings" },
  { key: "reconciliation", label: "Reconciliation" },
]

export default function ClientPageClient({
  clientId, projectionState, clientSlug, clientName, clientAgency, currentTab,
  initialStatus, initialStartDate, initialEndDate,
  metrics: initialMetrics, initialContracts, initialAccounts, initialAccountMonths, initialPayments, goal, initialCalls, products, initialRoadmap, initialPeople, initialSalaryMonths, initialHoursMonths,
}: Props) {
  const [contracts, setContracts] = useState<Contract[]>(initialContracts)
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts)
  const [metrics, setMetrics] = useState<Metric[]>(initialMetrics)
  const [payments, setPayments] = useState<Payment[]>(initialPayments)
  const [clientProducts, setClientProducts] = useState<Product[]>(products)
  const [people, setPeople] = useState<Person[]>(initialPeople)
  const [salaryMonths, setSalaryMonths] = useState<PersonSalaryMonth[]>(initialSalaryMonths)
  const [hoursMonths, setHoursMonths] = useState<PersonHoursMonth[]>(initialHoursMonths)
  const [reconView, setReconView] = useState<"reconcile" | "projection">("reconcile")

  const totalCapacityHours = people.reduce((s, p) => s + p.billableHours, 0)
  const totalHoursWorked = people.filter(p => !p.isExternal).reduce((s, p) => s + p.billableHours, 0)

  // Per-month payroll: for each metric month, sum each active person's salary override
  // or fall back to annualSalary / 12, respecting start/end dates.
  const payrollByMonth = useMemo(() => {
    const overrides = new Map<string, number>()
    salaryMonths.forEach(sm => overrides.set(`${sm.personId}:${sm.month}`, sm.monthlySalary))
    const map = new Map<string, number>()
    metrics.forEach(m => {
      let total = 0
      people.forEach(p => {
        const start = p.startDate ? p.startDate.slice(0, 7) : null
        const end = p.endDate ? p.endDate.slice(0, 7) : null
        if (start && m.month < start) return
        if (end && m.month > end) return
        total += overrides.get(`${p.id}:${m.month}`) ?? (p.annualSalary > 0 ? p.annualSalary / 12 : 0)
      })
      map.set(m.month, total)
    })
    return map
  }, [people, salaryMonths, metrics])

  function handleRevenueUpdate(month: string, revenue: number) {
    setMetrics(prev => {
      const exists = prev.find(m => m.month === month)
      if (exists) return prev.map(m => m.month === month ? { ...m, revenue } : m)
      return [...prev, { id: "", clientId, month, revenue, totalExpenses: 0, salaries: 0, software: 0, cashInBank: 0, leads: 0, newClients: 0, closeRate: 0, churn: 0, marketingSpend: 0 }]
    })
  }

  function handleContractAccountChange(contractId: string, accountId: string | null) {
    setContracts(prev => prev.map(c => c.id === contractId ? { ...c, accountId } : c))
  }

  const currency = goal?.currency ?? "USD"

  return (
    <CurrencyProvider currency={currency}>
    <div>
      <div style={{ marginBottom: 20 }}>
        <Link href="/clients" style={{ fontSize: 13, color: "#9C9590", textDecoration: "none" }}>← Clients</Link>
      </div>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 32, fontWeight: 600, color: "#1A1916", margin: 0, lineHeight: 1.1 }}>{clientName}</h1>
        {clientAgency && <div style={{ fontSize: 13, color: "#9C9590", marginTop: 4 }}>{clientAgency}</div>}
      </div>

      <div className="tab-strip" style={{ display: "flex", gap: 2, marginBottom: 24, borderBottom: "2px solid #ECE7DE", overflowX: "auto", scrollbarWidth: "none" }}>
        {TABS.map(t => (
          <Link
            key={t.key}
            href={`/clients/${clientSlug}/${t.key}`}
            style={{
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 600,
              borderBottom: currentTab === t.key ? "2px solid #E9532A" : "2px solid transparent",
              marginBottom: -2,
              color: currentTab === t.key ? "#E9532A" : "#9C9590",
              textDecoration: "none",
              display: "inline-block",
              whiteSpace: "nowrap",
              flexShrink: 0,
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
          projectionState={projectionState}
          clientSlug={clientSlug}
          clientName={clientName}
          metrics={metrics}
          contracts={contracts}
          goal={goal}
          payments={payments}
          initialStatus={initialStatus}
          initialStartDate={initialStartDate}
          initialEndDate={initialEndDate}
          totalCapacityHours={totalCapacityHours}
          totalHoursWorked={totalHoursWorked}
          payrollByMonth={payrollByMonth}
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

      {currentTab === "pipeline" && (
        <PipelinePanel
          clientId={clientId}
          contracts={contracts}
          accounts={accounts}
          onContractsChange={setContracts}
          onAccountCreated={account => setAccounts(prev => [...prev, account].sort((a, b) => a.name.localeCompare(b.name)))}
        />
      )}

      {currentTab === "projects" && (
        <ContractsPanel
          clientId={clientId}
          initialContracts={initialContracts}
          accounts={accounts}
          products={clientProducts}
          minHourlyRate={goal?.minHourlyRate ?? null}
          onContractsChange={updated => setContracts(updated)}
          onAccountCreated={account => setAccounts(prev => [...prev, account].sort((a, b) => a.name.localeCompare(b.name)))}
        />
      )}

      {currentTab === "reconciliation" && (
        <div>
          <div style={{ display: "flex", gap: 2, background: "#F5F1EC", borderRadius: 6, padding: 2, width: "fit-content", marginBottom: 16 }}>
            {([["reconcile", "Reconcile"], ["projection", "Projection"]] as const).map(([v, label]) => (
              <button key={v} onClick={() => setReconView(v)}
                style={{ padding: "4px 14px", fontSize: 12, fontWeight: 600, border: "none", borderRadius: 4, cursor: "pointer", background: reconView === v ? "#fff" : "transparent", color: reconView === v ? "#1A1916" : "#9C9590", boxShadow: reconView === v ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
                {label}
              </button>
            ))}
          </div>
          {reconView === "reconcile" ? (
            <ReconciliationTable
              contracts={contracts}
              accounts={accounts}
              initialAccountMonths={initialAccountMonths}
              initialPayments={initialPayments}
              onRevenueUpdate={handleRevenueUpdate}
              onPaymentsChange={setPayments}
              onContractUpdate={updated => setContracts(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c))}
            />
          ) : (
            <CashflowProjection contracts={contracts} />
          )}
        </div>
      )}

      {currentTab === "calls" && (
        <CallsClient
          calls={initialCalls}
          clients={[{ id: clientId, name: clientName }]}
          isCoach={true}
          defaultClientId={clientId}
          embedded
        />
      )}

      {currentTab === "progress" && (
        <ProgressPanel clientId={clientId} initialItems={initialRoadmap} />
      )}

      {currentTab === "products" && (
        <ProductsPanel
          clientId={clientId}
          initialProducts={clientProducts}
          onProductsChange={setClientProducts}
        />
      )}

      {currentTab === "goals" && (
        <GoalsPanel
          clientId={clientId}
          initialGoal={goal}
        />
      )}

      {currentTab === "team" && (
        <PeoplePanel
          clientId={clientId}
          initialPeople={people}
          initialSalaryMonths={salaryMonths}
          initialHoursMonths={hoursMonths}
          contracts={contracts}
          goal={goal}
          onPeopleChange={setPeople}
          onSalaryMonthChange={sm => setSalaryMonths(prev => {
            const idx = prev.findIndex(s => s.personId === sm.personId && s.month === sm.month)
            if (idx >= 0) return prev.map((s, i) => i === idx ? sm : s)
            return [...prev, sm]
          })}
          onHoursMonthChange={hm => setHoursMonths(prev => {
            const idx = prev.findIndex(h => h.personId === hm.personId && h.month === hm.month)
            if (idx >= 0) return prev.map((h, i) => i === idx ? hm : h)
            return [...prev, hm]
          })}
        />
      )}
    </div>
    </CurrencyProvider>
  )
}
