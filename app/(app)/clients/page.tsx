import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { currentMRR, type ContractRow } from "@/lib/calc"
import ClientCard from "./ClientCard"

export default async function ClientsPage() {
  const session = await auth()
  if (!session) redirect("/auth/signin")
  if (session.user.role !== "coach") redirect("/dashboard")

  const clients = await prisma.client.findMany({
    where: { status: { not: "archived" } },
    include: { contracts: true, metrics: { orderBy: { month: "desc" }, take: 1 } },
    orderBy: { name: "asc" },
  })

  const now = new Date().toISOString().slice(0, 7)

  return (
    <div>
      <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 28, fontWeight: 600, color: "#1A1916", margin: "0 0 24px" }}>
        Clients
      </h1>

      {clients.length === 0 ? (
        <div style={{ color: "#9C9590", fontSize: 14 }}>No clients yet. Convert a prospect to get started.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {clients.map(client => {
            const contractRows: ContractRow[] = client.contracts.map(c => ({
              monthly: c.monthly,
              start: c.start,
              contractedThrough: c.contractedThrough,
              status: c.status as "active" | "potential",
            }))
            const mrr = currentMRR(contractRows, now)
            const latest = client.metrics[0]

            return (
              <ClientCard
                key={client.id}
                id={client.id}
                name={client.name}
                agency={client.agency}
                status={client.status}
                mrr={mrr}
                latestRevenue={latest?.revenue ?? null}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
