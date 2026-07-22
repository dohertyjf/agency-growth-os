import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import Dashboard from "@/components/Dashboard"
import Link from "next/link"
import ContractsPanel from "./ContractsPanel"
import ClientStatusPanel from "./ClientStatusPanel"

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect("/auth/signin")
  if (session.user.role !== "coach") redirect("/dashboard")

  const { id } = await params

  const [client, metrics, goal, contracts] = await Promise.all([
    prisma.client.findUnique({ where: { id } }),
    prisma.monthlyMetric.findMany({ where: { clientId: id }, orderBy: { month: "asc" } }),
    prisma.goal.findUnique({ where: { clientId: id } }),
    prisma.contract.findMany({ where: { clientId: id }, orderBy: { start: "asc" } }),
  ])

  if (!client) notFound()

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <Link href="/clients" style={{ fontSize: 13, color: "#9C9590", textDecoration: "none" }}>← Clients</Link>
      </div>
      <Dashboard
        clientId={id}
        clientName={client.name}
        metrics={metrics}
        contracts={contracts}
        goal={goal}
      />
      <div style={{ marginTop: 32 }}>
        <ClientStatusPanel
          clientId={id}
          initialStatus={client.status as "active" | "paused" | "archived"}
          initialStartDate={client.startDate ?? null}
          initialEndDate={client.endDate ?? null}
        />
      </div>
      <div style={{ marginTop: 32 }}>
        <ContractsPanel clientId={id} initialContracts={contracts} />
      </div>
    </div>
  )
}
