import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import ClientPageClient from "../ClientPageClient"

const VALID_TABS = ["dashboard", "accounts", "projects", "reconciliation", "progress", "products"] as const
type Tab = typeof VALID_TABS[number]

export default async function ClientTabPage({ params }: { params: Promise<{ slug: string; tab: string }> }) {
  const session = await auth()
  if (!session) redirect("/auth/signin")
  if (session.user.role !== "coach") redirect("/dashboard")

  const { slug, tab } = await params
  if (!VALID_TABS.includes(tab as Tab)) notFound()

  const client = await prisma.client.findFirst({ where: { slug } })
  if (!client) notFound()

  const id = client.id

  const [metrics, goal, contracts, accountMonths, payments, accounts, products, roadmapItems] = await Promise.all([
    prisma.monthlyMetric.findMany({ where: { clientId: id }, orderBy: { month: "asc" } }),
    prisma.goal.findUnique({ where: { clientId: id } }),
    prisma.contract.findMany({ where: { clientId: id }, orderBy: { start: "asc" } }),
    prisma.accountMonth.findMany({ where: { contract: { clientId: id } } }),
    prisma.contractPayment.findMany({ where: { contract: { clientId: id } } }),
    prisma.account.findMany({ where: { clientId: id }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { clientId: id }, orderBy: { createdAt: "asc" } }),
    prisma.roadmapItem.findMany({ where: { clientId: id } }),
  ])

  return (
    <ClientPageClient
      clientId={id}
      clientSlug={slug}
      clientName={client.name}
      currentTab={tab as Tab}
      initialStatus={client.status as "potential" | "active" | "paused"}
      initialStartDate={client.startDate ?? null}
      initialEndDate={client.endDate ?? null}
      metrics={metrics}
      initialContracts={contracts.map(c => ({ ...c, accountId: c.accountId ?? null }))}
      initialAccounts={accounts.map(a => ({ id: a.id, name: a.name, contactName: a.contactName, contactEmail: a.contactEmail, notes: a.notes }))}
      initialAccountMonths={accountMonths.map(am => ({ contractId: am.contractId, month: am.month, actual: am.actual }))}
      initialPayments={payments.map(p => ({ contractId: p.contractId, month: p.month, amount: p.amount }))}
      goal={goal}
      products={products.map(p => ({ id: p.id, name: p.name, description: p.description ?? null, type: p.type as "retainer" | "oneoff", monthly: p.monthly }))}
      initialRoadmap={roadmapItems.map(r => ({ key: r.key, status: r.status as "none" | "red" | "yellow" | "green" }))}
    />
  )
}
