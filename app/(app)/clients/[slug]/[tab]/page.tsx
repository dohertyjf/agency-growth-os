import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import ClientPageClient from "../ClientPageClient"

const VALID_TABS = ["dashboard", "accounts", "pipeline", "projects", "reconciliation", "progress", "products", "goals", "team", "calls"] as const
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

  const [metrics, goal, contracts, accountMonths, payments, accounts, products, roadmapItems, people, salaryMonths, hoursMonths] = await Promise.all([
    prisma.monthlyMetric.findMany({ where: { clientId: id }, orderBy: { month: "asc" } }),
    prisma.goal.findUnique({ where: { clientId: id } }),
    prisma.contract.findMany({ where: { clientId: id }, orderBy: { start: "asc" } }),
    prisma.accountMonth.findMany({ where: { contract: { clientId: id } } }),
    prisma.contractPayment.findMany({ where: { contract: { clientId: id } } }),
    prisma.account.findMany({ where: { clientId: id }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { clientId: id }, orderBy: { createdAt: "asc" } }),
    prisma.roadmapItem.findMany({ where: { clientId: id } }),
    prisma.person.findMany({ where: { clientId: id }, orderBy: { createdAt: "asc" } }),
    prisma.personSalaryMonth.findMany({ where: { person: { clientId: id } } }),
    prisma.personHoursMonth.findMany({ where: { person: { clientId: id } } }),
  ])

  // This client's 1:1 calls plus every group call (group calls are shared).
  const calls = await prisma.call.findMany({
    where: { OR: [{ clientId: id }, { isGroupCall: true }] },
    include: { questions: { orderBy: { order: "asc" } } },
    orderBy: { date: "desc" },
  })

  const contractHours = await prisma.contractHoursMonth.findMany({ where: { contract: { clientId: id } } })
  const contractPulses = await prisma.contractPulse.findMany({ where: { contract: { clientId: id } } })
  const noteCountRows = await prisma.contractNote.groupBy({ by: ["contractId"], where: { contract: { clientId: id } }, _count: { _all: true } })
  const noteCounts: Record<string, number> = {}
  for (const r of noteCountRows) noteCounts[r.contractId] = r._count._all

  return (
    <ClientPageClient
      clientId={id}
      projectionState={client.projectionState}
      clientSlug={slug}
      clientName={client.name}
      clientAgency={client.agency ?? null}
      currentTab={tab as Tab}
      initialStatus={client.status as "potential" | "active" | "paused"}
      initialStartDate={client.startDate ?? null}
      initialEndDate={client.endDate ?? null}
      metrics={metrics}
      initialContracts={contracts.map(c => ({ ...c, accountId: c.accountId ?? null, contractedThrough: c.contractedThrough ?? null, hoursPerMonth: c.hoursPerMonth, callDate: c.callDate ?? null, signedDate: c.signedDate ?? null, kickoffDate: c.kickoffDate ?? null }))}
      initialPeople={people.map(p => ({ id: p.id, name: p.name, role: p.role ?? null, responsibilities: p.responsibilities ?? null, isExternal: p.isExternal, isFullTime: p.isFullTime, annualSalary: p.annualSalary, billableHours: p.billableHours, startDate: p.startDate ?? null, endDate: p.endDate ?? null }))}
      initialSalaryMonths={salaryMonths.map(s => ({ personId: s.personId, month: s.month, monthlySalary: s.monthlySalary }))}
      initialHoursMonths={hoursMonths.map(h => ({ personId: h.personId, month: h.month, monthlyHours: h.monthlyHours }))}
      initialAccounts={accounts.map(a => ({ id: a.id, name: a.name, contactName: a.contactName, contactEmail: a.contactEmail, notes: a.notes }))}
      initialAccountMonths={accountMonths.map(am => ({ contractId: am.contractId, month: am.month, actual: am.actual }))}
      initialPayments={payments.map(p => ({ contractId: p.contractId, month: p.month, amount: p.amount }))}
      initialContractHours={contractHours.map(h => ({ contractId: h.contractId, month: h.month, hours: h.hours }))}
      initialPulses={contractPulses.map(p => ({ contractId: p.contractId, month: p.month, score: p.score, note: p.note ?? null }))}
      initialNoteCounts={noteCounts}
      goal={goal}
      initialCalls={calls.map(c => ({ id: c.id, clientId: c.clientId, date: c.date, title: c.title, transcript: c.transcript ?? null, video: c.video ?? null, synopsis: c.synopsis ?? null, notes: c.notes ?? null, isGroupCall: c.isGroupCall, questions: c.questions.map(q => ({ id: q.id, q: q.q, a: q.a ?? null, order: q.order })) }))}
      products={products.map(p => ({ id: p.id, name: p.name, description: p.description ?? null, type: p.type as "retainer" | "ongoing" | "oneoff", monthly: p.monthly }))}
      initialRoadmap={roadmapItems.map(r => ({ key: r.key, status: r.status as "none" | "red" | "yellow" | "green" }))}
    />
  )
}
