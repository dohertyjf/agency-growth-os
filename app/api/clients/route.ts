import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const schema = z.object({
  name: z.string().min(1),
  agency: z.string().optional(),
  email: z.string().email(),
  status: z.enum(["potential", "active", "paused"]).default("active"),
  startDate: z.string().optional(),
})

export async function POST(req: Request) {
  const session = await auth()
  if (!session || session.user.role !== "coach") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 422 })

  const { name, agency, email, status, startDate } = parsed.data

  const existing = await prisma.client.findUnique({ where: { email } })
  if (existing) return Response.json({ error: "A client with that email already exists" }, { status: 409 })

  const client = await prisma.client.create({
    data: { name, agency: agency ?? null, email, status, startDate: startDate ?? null },
  })

  return Response.json(client, { status: 201 })
}
