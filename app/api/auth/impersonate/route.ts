import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

// Switch user (like WordPress's "Switch To"): the coach uses the app as a
// client, then switches back.
//
// This route only decides WHICH user to switch to. The switch itself happens
// in the browser via next-auth's own session endpoint (POST /api/auth/session
// with `data: { switchToUserId }`), because that path returns the session
// cookie on the response directly. Writing it here through `unstable_update`
// / `cookies().set()` silently never reached the browser on Netlify. The JWT
// callback in auth.ts re-verifies both directions against the DB, so nothing
// in the browser can escalate.

// POST { clientId } — resolve the client's login to switch into.
export async function POST(req: Request) {
  const session = await auth()
  if (!session || session.user.role !== "coach" || session.user.impersonator) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }
  const body = await req.json().catch(() => null)
  const clientId = typeof body?.clientId === "string" ? body.clientId : null
  if (!clientId) return Response.json({ error: "clientId required" }, { status: 400 })

  // Refuse to switch if the coach's own login row is gone (a stale session
  // from a deleted user) — there would be nothing to switch back to.
  const self = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!self || self.role !== "coach") {
    return Response.json({ error: "Your login session is out of date. Sign out and back in, then try again." }, { status: 409 })
  }

  const target = await prisma.user.findFirst({ where: { clientId, role: "client" } })
  if (!target) return Response.json({ error: "This client has no login yet." }, { status: 404 })

  return Response.json({ userId: target.id })
}
