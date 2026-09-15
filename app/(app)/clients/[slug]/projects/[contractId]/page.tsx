import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { CurrencyProvider } from "@/lib/CurrencyContext"
import ProjectDetailClient from "./ProjectDetailClient"

export default async function ProjectDetailPage({ params }: { params: Promise<{ slug: string; contractId: string }> }) {
  const session = await auth()
  if (!session) redirect("/auth/signin")

  const { slug, contractId } = await params
  const client = await prisma.client.findFirst({ where: { slug } })
  if (!client) notFound()

  // A client may only view their OWN profile; a coach may view any.
  if (session.user.role !== "coach" && session.user.clientId !== client.id) {
    redirect("/dashboard")
  }
  const id = client.id

  const contract = await prisma.contract.findFirst({ where: { id: contractId, clientId: id } })
  if (!contract) notFound()

  const [account, people, salaryMonths, capacityMonths, members, memberHours, contractHours, costItems, accountMonths, payments, pulses, goal, products] = await Promise.all([
    contract.accountId ? prisma.account.findUnique({ where: { id: contract.accountId } }) : Promise.resolve(null),
    prisma.person.findMany({ where: { clientId: id }, orderBy: { createdAt: "asc" } }),
    prisma.personSalaryMonth.findMany({ where: { person: { clientId: id } } }),
    prisma.personHoursMonth.findMany({ where: { person: { clientId: id } } }),
    prisma.projectMember.findMany({ where: { contractId } }),
    prisma.projectMemberHoursMonth.findMany({ where: { contractId } }),
    prisma.contractHoursMonth.findMany({ where: { contractId } }),
    prisma.projectCostItem.findMany({ where: { contractId }, orderBy: { createdAt: "asc" }, include: { months: true } }),
    prisma.accountMonth.findMany({ where: { contractId } }),
    prisma.contractPayment.findMany({ where: { contractId } }),
    prisma.contractPulse.findMany({ where: { contractId } }),
    prisma.goal.findUnique({ where: { clientId: id } }),
    prisma.product.findMany({ where: { clientId: id }, orderBy: { createdAt: "asc" } }),
  ])

  return (
    <CurrencyProvider currency={goal?.currency ?? "USD"}>
      <ProjectDetailClient
        clientSlug={slug}
        clientName={client.name}
        minHourlyRate={goal?.minHourlyRate ?? null}
        contract={{
          id: contract.id, name: contract.name, monthly: contract.monthly, hoursPerMonth: contract.hoursPerMonth,
          start: contract.start, contractedThrough: contract.contractedThrough ?? null, status: contract.status, type: contract.type,
          accountId: contract.accountId ?? null, ownerId: contract.ownerId ?? null, productId: contract.productId ?? null,
          deliveryStart: contract.deliveryStart ?? null, deliveryEnd: contract.deliveryEnd ?? null,
        }}
        account={account ? { id: account.id, name: account.name } : null}
        products={products.map(p => ({ id: p.id, name: p.name, type: p.type }))}
        people={people.map(p => ({ id: p.id, name: p.name, role: p.role ?? null, isExternal: p.isExternal, annualSalary: p.annualSalary, billableHours: p.billableHours }))}
        salaryMonths={salaryMonths.map(s => ({ personId: s.personId, month: s.month, monthlySalary: s.monthlySalary }))}
        capacityMonths={capacityMonths.map(h => ({ personId: h.personId, month: h.month, monthlyHours: h.monthlyHours }))}
        members={members.map(m => ({ personId: m.personId, role: m.role ?? null }))}
        memberHours={memberHours.map(h => ({ contractId: h.contractId, personId: h.personId, month: h.month, hours: h.hours }))}
        contractHours={contractHours.map(h => ({ contractId: h.contractId, month: h.month, hours: h.hours }))}
        costItems={costItems.map(i => ({ id: i.id, contractId: i.contractId, name: i.name, category: i.category, reimbursed: i.reimbursed }))}
        costMonths={costItems.flatMap(i => i.months.map(m => ({ costItemId: m.costItemId, month: m.month, amount: m.amount })))}
        accountMonths={accountMonths.map(a => ({ contractId: a.contractId, month: a.month, actual: a.actual }))}
        payments={payments.map(p => ({ contractId: p.contractId, month: p.month, amount: p.amount }))}
        pulses={pulses.map(p => ({ contractId: p.contractId, month: p.month, score: p.score, note: p.note ?? null }))}
      />
    </CurrencyProvider>
  )
}
