import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import AddClientModal from "./AddClientModal"
import ClientsGrid from "./ClientsGrid"

export default async function ClientsPage() {
  const session = await auth()
  if (!session) redirect("/auth/signin")
  if (session.user.role !== "coach") redirect("/dashboard")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clients = await prisma.client.findMany({
    where: { status: { in: ["potential", "active", "paused"] as any } },
    include: { contracts: true, metrics: { orderBy: { month: "desc" }, take: 1 } },
  }) as any[]

  const now = new Date().toISOString().slice(0, 7)

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 28, fontWeight: 600, color: "#1A1916", margin: 0 }}>
          Clients
        </h1>
        <AddClientModal />
      </div>
      <ClientsGrid clients={clients} now={now} />
    </div>
  )
}
