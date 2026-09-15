import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { SignJWT } from "jose"
import { hashToken } from "@/lib/inviteToken"

// 7 days — long enough to send a client a link and have them act on it.
const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000

const schema = z.object({
  // Optional override; defaults to the client's own email on file.
  email: z.string().email().optional(),
})

// Login status for the coach's Settings panel: is there a client user, and
// have they set a password yet?
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session || session.user.role !== "coach") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const client = await prisma.client.findUnique({ where: { id } })
  if (!client) return Response.json({ error: "Not found" }, { status: 404 })

  const user = await prisma.user.findFirst({
    where: { clientId: id, role: "client" },
    select: { email: true, passwordHash: true },
  })

  const pendingInvite = user
    ? await prisma.inviteToken.findFirst({
        where: { email: user.email, used: false, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
      })
    : null

  return Response.json({
    clientEmail: client.email,
    user: user ? { email: user.email, hasPassword: !!user.passwordHash } : null,
    invitePending: !!pendingInvite,
  })
}

// Create (or link) the client's login user and mint a fresh invite link.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session || session.user.role !== "coach") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const client = await prisma.client.findUnique({ where: { id } })
  if (!client) return Response.json({ error: "Not found" }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body ?? {})
  if (!parsed.success) return Response.json({ error: "Invalid email" }, { status: 422 })

  const email = (parsed.data.email ?? client.email).toLowerCase().trim()
  if (!email) return Response.json({ error: "No email on file for this client" }, { status: 422 })

  // Never repurpose a coach account (or a user linked to a different client)
  // into this client's login.
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing && existing.role === "coach") {
    return Response.json({ error: "That email belongs to a coach account." }, { status: 409 })
  }
  if (existing && existing.clientId && existing.clientId !== id) {
    return Response.json({ error: "That email is already linked to another client." }, { status: 409 })
  }

  const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? "secret")
  const token = await new SignJWT({ email, type: "invite" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(secret)
  const expiresAt = new Date(Date.now() + EXPIRY_MS)

  await prisma.$transaction([
    // Ensure the login user exists and is linked to this profile. Creating it
    // (with no passwordHash) is what makes set-password's user.update succeed.
    prisma.user.upsert({
      where: { email },
      update: { clientId: id, role: "client" },
      create: { email, name: client.name, role: "client", clientId: id },
    }),
    // Store only the hash — the raw token lives solely in the link we return.
    prisma.inviteToken.create({ data: { email, token: hashToken(token), expiresAt } }),
  ])

  const origin = req.headers.get("origin") ?? new URL(req.url).origin
  const link = `${origin}/auth/set-password/${token}`

  return Response.json({ email, link, expiresAt: expiresAt.toISOString() }, { status: 201 })
}
