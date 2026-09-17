import { auth, unstable_update } from "@/auth"
import { prisma } from "@/lib/prisma"

// Switch user (like WordPress's "Switch To"): the coach uses the app as a
// client, then switches back. The JWT callback in auth.ts re-verifies both
// directions against the DB, so this route only decides which user to ask for.

// POST { clientId } — start using the app as that client's login.
export async function POST(req: Request) {
  const session = await auth()
  if (!session || session.user.role !== "coach" || session.user.impersonator) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }
  const body = await req.json().catch(() => null)
  const clientId = typeof body?.clientId === "string" ? body.clientId : null
  if (!clientId) return Response.json({ error: "clientId required" }, { status: 400 })

  const target = await prisma.user.findFirst({ where: { clientId, role: "client" } })
  if (!target) return Response.json({ error: "This client has no login yet." }, { status: 404 })

  const updated = await unstable_update({ switchToUserId: target.id } as never)
  if (updated?.user?.id !== target.id) return Response.json({ error: "Could not switch user." }, { status: 500 })
  return Response.json({ ok: true })
}

// DELETE — switch back to the coach.
export async function DELETE() {
  const session = await auth()
  const coachId = session?.user?.impersonator?.id
  if (!coachId) return Response.json({ error: "Not switched." }, { status: 400 })

  const updated = await unstable_update({ switchToUserId: coachId } as never)
  if (updated?.user?.id !== coachId) return Response.json({ error: "Could not switch back." }, { status: 500 })
  return Response.json({ ok: true })
}
