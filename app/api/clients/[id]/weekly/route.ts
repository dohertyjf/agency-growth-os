import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const FIELDS = ["leads", "callsScheduled", "callsHeld", "deepDives", "proposalsSent", "newClients", "marketingSpend", "revenue"] as const

const schema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  leads: z.number().optional(),
  callsScheduled: z.number().optional(),
  callsHeld: z.number().optional(),
  deepDives: z.number().optional(),
  proposalsSent: z.number().optional(),
  newClients: z.number().optional(),
  marketingSpend: z.number().optional(),
  revenue: z.number().optional(),
})

/** Coach, or the client user the row belongs to. */
async function authorize(clientId: string) {
  const session = await auth()
  if (!session) return false
  if (session.user.role === "coach") return true
  return session.user.clientId === clientId
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!(await authorize(id))) return Response.json({ error: "Forbidden" }, { status: 403 })

  const rows = await prisma.weeklyMetric.findMany({
    where: { clientId: id },
    orderBy: { weekStart: "asc" },
  })
  return Response.json(rows)
}

const bulkSchema = z.array(schema).min(1).max(400)

/** Bulk upsert — a pasted spreadsheet. Each row replaces that week outright,
 *  so re-importing a corrected paste fixes rather than compounds. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!(await authorize(id))) return Response.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = bulkSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: z.treeifyError(parsed.error) }, { status: 422 })

  const bad = parsed.data.find(r => new Date(`${r.weekStart}T00:00:00Z`).getUTCDay() !== 0)
  if (bad) return Response.json({ error: `weekStart must be a Sunday: ${bad.weekStart}` }, { status: 422 })

  const written = await prisma.$transaction(
    parsed.data.map(({ weekStart, ...rest }) => {
      const data: Record<string, number> = {}
      for (const f of FIELDS) data[f] = rest[f] ?? 0
      return prisma.weeklyMetric.upsert({
        where: { clientId_weekStart: { clientId: id, weekStart } },
        create: { clientId: id, weekStart, ...data },
        update: data,
      })
    })
  )
  return Response.json(written)
}

/** Upsert one week. Only the fields present are written, so a single edited
 *  cell never clobbers the rest of its row. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!(await authorize(id))) return Response.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: z.treeifyError(parsed.error) }, { status: 422 })

  const { weekStart, ...rest } = parsed.data

  // The grouping rule assumes a Sunday; reject anything else rather than
  // quietly filing a row under a week that will never be rendered.
  if (new Date(`${weekStart}T00:00:00Z`).getUTCDay() !== 0) {
    return Response.json({ error: "weekStart must be a Sunday" }, { status: 422 })
  }

  const data: Record<string, number> = {}
  for (const f of FIELDS) if (rest[f] !== undefined) data[f] = rest[f]

  const row = await prisma.weeklyMetric.upsert({
    where: { clientId_weekStart: { clientId: id, weekStart } },
    create: { clientId: id, weekStart, ...data },
    update: data,
  })
  return Response.json(row)
}
