import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import ClientPageClient from "./ClientPageClient"

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect("/auth/signin")
  if (session.user.role !== "coach") redirect("/dashboard")

  const { id } = await params

  const [client, metrics, goal, contracts, accountMonths, payments] = await Promise.all([
    prisma.client.findUnique({ where: { id } }),
    prisma.monthlyMetric.findMany({ where: { clientId: id }, orderBy: { month: "asc" } }),
    prisma.goal.findUnique({ where: { clientId: id } }),
    prisma.contract.findMany({ where: { clientId: id }, orderBy: { start: "asc" } }),
    prisma.accountMonth.findMany({ where: { contract: { clientId: id } } }),
    prisma.contractPayment.findMany({ where: { contract: { clientId: id } } }),
  ])

  if (!client) notFound()

  return (
    <ClientPageClient
      clientId={id}
      clientName={client.name}
      initialStatus={client.status as "potential" | "active" | "paused"}
      initialStartDate={client.startDate ?? null}
      initialEndDate={client.endDate ?? null}
      metrics={metrics}
      initialContracts={contracts}
      initialAccountMonths={accountMonths.map(am => ({ contractId: am.contractId, month: am.month, actual: am.actual }))}
      initialPayments={payments.map(p => ({ contractId: p.contractId, month: p.month, amount: p.amount }))}
      goal={goal}
    />
  )
}
