import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

// Create a sales call by hand (the Calls page's Sales Calls tab). Sales calls
// have no client, so they never show up anywhere a client can see.
const schema = z.object({
  title: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  prospectEmail: z.string().optional(),
})

export async function POST(req: Request) {
  const session = await auth()
  if (!session || session.user.role !== "coach") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: "Invalid" }, { status: 422 })

  const call = await prisma.call.create({
    data: { ...parsed.data, clientId: null, isSalesCall: true },
    include: { questions: true },
  })
  return Response.json(call, { status: 201 })
}
