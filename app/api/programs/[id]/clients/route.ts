import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

// Replace the full set of clients in a program. Coach-only.
const schema = z.object({ clientIds: z.array(z.string()) })

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session || session.user.role !== "coach") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }
  const { id } = await params
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: "Invalid" }, { status: 422 })

  const clientIds = [...new Set(parsed.data.clientIds)]
  await prisma.$transaction([
    prisma.programMembership.deleteMany({ where: { programId: id } }),
    prisma.programMembership.createMany({
      data: clientIds.map(clientId => ({ clientId, programId: id })),
      skipDuplicates: true,
    }),
  ])
  return Response.json({ ok: true, clientIds })
}
