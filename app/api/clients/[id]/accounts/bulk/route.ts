import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

function authorize(session: import("next-auth").Session | null, clientId: string) {
  if (!session) return false
  if (session.user.role === "coach") return true
  return session.user.clientId === clientId
}

const rowSchema = z.object({
  accountName: z.string().min(1),
  projectName: z.string().min(1),
  type: z.enum(["retainer", "ongoing", "oneoff"]).default("retainer"),
  monthly: z.number().min(0),
  status: z.enum(["potential", "active", "finished"]).default("active"),
  start: z.string().regex(/^\d{4}-\d{2}$/),
  contractedThrough: z.string().regex(/^\d{4}-\d{2}$/).nullable().optional(),
})

const schema = z.array(rowSchema).min(1).max(200)

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const { id } = await params
  if (!authorize(session, id)) return Response.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: "Invalid", details: parsed.error.flatten() }, { status: 422 })

  // Ongoing retainers have no end — unless they're finished, in which case the sheet's
  // end date is when they ended and must be present (otherwise they count as MRR forever).
  const rows = parsed.data.map(row => ({
    ...row,
    contractedThrough:
      row.type === "oneoff" ? row.start
      : row.type === "ongoing" && row.status !== "finished" ? null
      : (row.contractedThrough ?? null),
  }))
  const missingEnd = rows.filter(r => r.status === "finished" && r.type !== "oneoff" && !r.contractedThrough)
  if (missingEnd.length) {
    return Response.json({ error: `Finished retainers need an end month: ${missingEnd.map(r => r.projectName).join(", ")}` }, { status: 422 })
  }

  // Collect unique account names and find or create each
  const uniqueNames = [...new Set(parsed.data.map(r => r.accountName))]
  const existing = await prisma.account.findMany({
    where: { clientId: id, name: { in: uniqueNames } },
  })
  const existingMap = new Map(existing.map(a => [a.name, a]))

  const toCreate = uniqueNames.filter(n => !existingMap.has(n))
  const created = toCreate.length
    ? await prisma.$transaction(
        toCreate.map(name => prisma.account.create({ data: { clientId: id, name } }))
      )
    : []

  const accountMap = new Map([...existing, ...created].map(a => [a.name, a]))

  // Create all projects linked to their accounts
  const contracts = await prisma.$transaction(
    rows.map(row => {
      const account = accountMap.get(row.accountName)!
      return prisma.contract.create({
        data: {
          clientId: id,
          accountId: account.id,
          name: row.projectName,
          type: row.type === "ongoing" ? "retainer" : row.type,
          monthly: row.monthly,
          status: row.status,
          start: row.start,
          contractedThrough: row.contractedThrough,
        },
      })
    })
  )

  return Response.json({ accounts: created, contracts }, { status: 201 })
}
