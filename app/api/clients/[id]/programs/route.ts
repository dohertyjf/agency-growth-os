import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

// Replace the full set of programs a client belongs to. Coach-only.
const schema = z.object({ programIds: z.array(z.string()) })

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

  const programIds = [...new Set(parsed.data.programIds)]
  await prisma.$transaction([
    prisma.programMembership.deleteMany({ where: { clientId: id } }),
    prisma.programMembership.createMany({
      data: programIds.map(programId => ({ clientId: id, programId })),
      skipDuplicates: true,
    }),
  ])
  return Response.json({ ok: true, programIds })
}
