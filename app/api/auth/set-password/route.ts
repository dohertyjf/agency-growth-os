import { prisma } from "@/lib/prisma"
import { jwtVerify } from "jose"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { hashToken } from "@/lib/inviteToken"

const schema = z.object({
  token: z.string(),
  password: z.string().min(8),
})

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: "Invalid" }, { status: 422 })

  const { token, password } = parsed.data
  const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? "secret")

  let email: string
  try {
    const { payload } = await jwtVerify(token, secret)
    if (payload.type !== "invite" || typeof payload.email !== "string") {
      throw new Error("Invalid token type")
    }
    email = payload.email
  } catch {
    return Response.json({ error: "Invalid or expired token" }, { status: 400 })
  }

  // Look up by the token's hash — the DB never holds the raw token.
  const tokenHash = hashToken(token)
  const invite = await prisma.inviteToken.findUnique({ where: { token: tokenHash } })
  if (!invite || invite.used || invite.expiresAt < new Date()) {
    return Response.json({ error: "Token expired or already used" }, { status: 400 })
  }

  const hash = await bcrypt.hash(password, 12)
  await prisma.$transaction([
    prisma.user.update({ where: { email }, data: { passwordHash: hash } }),
    prisma.inviteToken.update({ where: { token: tokenHash }, data: { used: true } }),
  ])

  return Response.json({ ok: true })
}
