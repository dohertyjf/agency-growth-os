import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const schema = z.object({
  status: z.enum(["active", "paused", "archived"]).optional(),
  endDate: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  name: z.string().min(1).optional(),
  agency: z.string().nullable().optional(),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session || session.user.role !== "coach") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 422 })

  const client = await prisma.client.update({
    where: { id },
    data: parsed.data,
  })

  return Response.json(client)
}
