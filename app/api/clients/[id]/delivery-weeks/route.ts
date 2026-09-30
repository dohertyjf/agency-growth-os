import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

function authorize(session: import("next-auth").Session | null, clientId: string) {
  if (!session) return false
  if (session.user.role === "coach") return true
  return session.user.clientId === clientId
}

const schema = z.object({
  week: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(w => new Date(`${w}T00:00:00Z`).getUTCDay() === 0, "week must be a Sunday"),
  contractIds: z.array(z.string()).min(1).max(500),
  // A number sets every listed project's week (0 = zeroed out, e.g. vacation);
  // null clears their overrides so the week falls back to the monthly plan.
  hours: z.number().min(0).max(168).nullable(),
})

// Set or clear one week across several projects at once (Projects → Capacity column actions).
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const { id } = await params
  if (!authorize(session, id)) return Response.json({ error: "Forbidden" }, { status: 403 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: "Invalid" }, { status: 422 })

  const { week, hours } = parsed.data
  // Only this client's projects — ignore any id that isn't theirs.
  const owned = await prisma.contract.findMany({ where: { id: { in: parsed.data.contractIds }, clientId: id }, select: { id: true } })
  const ids = owned.map(c => c.id)

  if (hours === null) {
    await prisma.contractDeliveryWeek.deleteMany({ where: { contractId: { in: ids }, week } })
  } else {
    await prisma.$transaction(ids.map(contractId => prisma.contractDeliveryWeek.upsert({
      where: { contractId_week: { contractId, week } },
      create: { contractId, week, hours },
      update: { hours },
    })))
  }
  return Response.json({ week, hours, contractIds: ids })
}
