import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { CurrencyProvider } from "@/lib/CurrencyContext"
import AccountDetailClient from "./AccountDetailClient"

export default async function AccountDetailPage({ params }: { params: Promise<{ slug: string; accountId: string }> }) {
  const session = await auth()
  if (!session) redirect("/auth/signin")
  if (session.user.role !== "coach") redirect("/dashboard")

  const { slug, accountId } = await params
  const client = await prisma.client.findFirst({ where: { slug } })
  if (!client) notFound()
  const id = client.id

  const account = await prisma.account.findFirst({ where: { id: accountId, clientId: id } })
  if (!account) notFound()

  const [contracts, accounts, people, products, goal] = await Promise.all([
    prisma.contract.findMany({ where: { clientId: id, accountId }, orderBy: { start: "asc" } }),
    prisma.account.findMany({ where: { clientId: id }, orderBy: { name: "asc" } }),
    prisma.person.findMany({ where: { clientId: id }, orderBy: { createdAt: "asc" } }),
    prisma.product.findMany({ where: { clientId: id }, orderBy: { createdAt: "asc" } }),
    prisma.goal.findUnique({ where: { clientId: id } }),
  ])

  const contractIds = contracts.map(c => c.id)
  const [pulses, hours, payments, members, notes] = await Promise.all([
    prisma.contractPulse.findMany({ where: { contractId: { in: contractIds } } }),
    prisma.contractHoursMonth.findMany({ where: { contractId: { in: contractIds } } }),
    prisma.contractPayment.findMany({ where: { contractId: { in: contractIds } } }),
    prisma.projectMember.findMany({ where: { contractId: { in: contractIds } } }),
    prisma.accountNote.findMany({ where: { accountId }, orderBy: { createdAt: "desc" } }),
  ])

  return (
    <CurrencyProvider currency={goal?.currency ?? "USD"}>
      <AccountDetailClient
        clientId={id}
        clientSlug={slug}
        clientName={client.name}
        minHourlyRate={goal?.minHourlyRate ?? null}
        account={{ id: account.id, name: account.name, contactName: account.contactName, contactEmail: account.contactEmail, ownerId: account.ownerId }}
        allAccounts={accounts.map(a => ({ id: a.id, name: a.name }))}
        people={people.map(p => ({ id: p.id, name: p.name, role: p.role ?? null, isExternal: p.isExternal }))}
        products={products.map(p => ({ id: p.id, name: p.name, type: p.type as "retainer" | "ongoing" | "oneoff", monthly: p.monthly }))}
        contracts={contracts.map(c => ({ id: c.id, name: c.name, monthly: c.monthly, hoursPerMonth: c.hoursPerMonth, start: c.start, contractedThrough: c.contractedThrough ?? null, status: c.status, type: c.type, ownerId: c.ownerId ?? null }))}
        pulses={pulses.map(p => ({ contractId: p.contractId, month: p.month, score: p.score, note: p.note ?? null }))}
        hours={hours.map(h => ({ contractId: h.contractId, month: h.month, hours: h.hours }))}
        payments={payments.map(p => ({ contractId: p.contractId, month: p.month, amount: p.amount }))}
        members={members.map(m => ({ contractId: m.contractId, personId: m.personId, role: m.role ?? null }))}
        notes={notes.map(n => ({ id: n.id, body: n.body, author: n.author ?? null, createdAt: n.createdAt.toISOString() }))}
      />
    </CurrencyProvider>
  )
}
