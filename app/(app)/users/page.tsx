import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import UsersClient, { type UserRow } from "./UsersClient"

// Every client and the state of their login, so a coach can deactivate
// someone who's no longer a client (and reactivate them if they come back).
export default async function UsersPage() {
  const session = await auth()
  if (!session) redirect("/auth/signin")
  if (session.user.role !== "coach") redirect("/dashboard")

  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true, slug: true, name: true, agency: true, email: true, status: true,
      users: { where: { role: "client" }, select: { email: true, active: true, passwordHash: true, createdAt: true }, take: 1 },
      memberships: { select: { program: { select: { name: true } } } },
    },
  })

  const rows: UserRow[] = clients.map(c => {
    const u = c.users[0]
    return {
      clientId: c.id,
      slug: c.slug,
      name: c.name,
      agency: c.agency,
      email: u?.email ?? c.email,
      clientStatus: c.status,
      programs: c.memberships.map(m => m.program.name).sort(),
      login: !u ? "none" : !u.active ? "deactivated" : u.passwordHash ? "active" : "invited",
      since: u ? u.createdAt.toISOString().slice(0, 10) : null,
      hasPassword: !!u?.passwordHash,
    }
  })

  return <UsersClient initialRows={rows} />
}
