import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

async function authorize(session: import("next-auth").Session | null, contractId: string) {
  if (!session) return null
  const contract = await prisma.contract.findUnique({ where: { id: contractId } })
  if (!contract) return null
  if (session.user.role === "coach") return contract
  if (session.user.clientId === contract.clientId) return contract
  return null
}

const schema = z.object({
  week: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(w => new Date(`${w}T00:00:00Z`).getUTCDay() === 0, "week must be a Sunday"),
  // null clears the override so the week falls back to the monthly plan.
  hours: z.number().min(0).max(168).nullable(),
})

// Set (or clear) the hand-planned hours for one project in one week.
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const session = await auth()
  const { contractId } = await params
  if (!(await authorize(session, contractId))) return Response.json({ error: "Forbidden" }, { status: 403 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: "Invalid" }, { status: 422 })

  const { week, hours } = parsed.data
  if (hours === null) {
    await prisma.contractDeliveryWeek.deleteMany({ where: { contractId, week } })
    return Response.json({ week, hours: null })
  }
  const row = await prisma.contractDeliveryWeek.upsert({
    where: { contractId_week: { contractId, week } },
    create: { contractId, week, hours },
    update: { hours },
  })
  return Response.json({ week: row.week, hours: row.hours })
}
