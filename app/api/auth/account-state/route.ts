import { prisma } from "@/lib/prisma"
import { z } from "zod"

// Public pre-auth check used only to show a clearer sign-in message. It reveals
// nothing beyond "this email is a deactivated login" — which is exactly what the
// coach wants a former client to be told. Every other case returns false.
const schema = z.object({ email: z.string().email() })

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ deactivated: false })

  const email = parsed.data.email.toLowerCase().trim()
  const user = await prisma.user.findUnique({
    where: { email },
    select: { active: true, passwordHash: true },
  })
  const deactivated = !!user?.passwordHash && user.active === false
  return Response.json({ deactivated })
}
