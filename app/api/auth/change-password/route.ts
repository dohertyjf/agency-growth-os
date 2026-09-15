import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import bcrypt from "bcryptjs"

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
})

// Any signed-in user (coach or client) sets a new password for their own
// account. Requires the current password so a borrowed/left-open session
// can't silently change it.
export async function POST(req: Request) {
  const session = await auth()
  if (!session) return Response.json({ error: "Not signed in" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "New password must be at least 8 characters." }, { status: 422 })
  }
  const { currentPassword, newPassword } = parsed.data

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user?.passwordHash) {
    return Response.json({ error: "No password set on this account." }, { status: 400 })
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!valid) return Response.json({ error: "Current password is incorrect." }, { status: 400 })

  const hash = await bcrypt.hash(newPassword, 12)
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hash } })

  return Response.json({ ok: true })
}
