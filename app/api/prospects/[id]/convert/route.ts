import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { ymAdd } from "@/lib/calc"
import { SignJWT } from "jose"

const schema = z.object({
  annualRevenue: z.number().min(0),
  profit: z.number().min(0),
  invite: z.boolean().default(true),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session || session.user.role !== "coach") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const s = await prisma.intakeSubmission.findUnique({ where: { id } })
  if (!s) return Response.json({ error: "Not found" }, { status: 404 })

  if (s.converted && s.clientId) {
    return Response.json({ clientId: s.clientId })
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: "Invalid" }, { status: 422 })

  const { annualRevenue, profit, invite } = parsed.data
  const data = JSON.parse(s.data) as Record<string, string[]>

  // Create client + goal in a transaction
  const client = await prisma.$transaction(async (tx) => {
    const c = await tx.client.create({
      data: {
        name: s.name || s.email,
        agency: s.agency ?? null,
        email: s.email,
        status: "active",
      },
    })

    await tx.goal.create({
      data: { clientId: c.id, annualRevenue, profit },
    })

    // Convert intake arrays → MonthlyMetric rows
    // data[key][0] = last month, [1] = 2mo ago, [2] = 3mo ago
    const now = new Date().toISOString().slice(0, 7) // YYYY-MM
    for (let offset = 0; offset < 3; offset++) {
      const month = ymAdd(now, -(offset + 1)) // last, 2mo ago, 3mo ago
      const g = (key: string) => parseFloat(data[key]?.[offset] ?? "0") || 0
      const ql = g("qualifiedLeads")
      const nc = g("newClients")
      await tx.monthlyMetric.upsert({
        where: { clientId_month: { clientId: c.id, month } },
        update: {},
        create: {
          clientId: c.id,
          month,
          revenue: g("overallRevenue"),
          salaries: g("peopleCost"),
          leads: g("leads"),
          newClients: nc,
          closeRate: ql > 0 ? (nc / ql) * 100 : 0,
          churn: g("churnedClients"),
        },
      })
    }

    await tx.intakeSubmission.update({
      where: { id },
      data: { converted: true, clientId: c.id },
    })

    if (invite) {
      await tx.user.upsert({
        where: { email: s.email },
        update: { clientId: c.id, role: "client" },
        create: { email: s.email, name: s.name ?? null, role: "client", clientId: c.id },
      })

      // Create invite token (valid 48h)
      const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? "secret")
      const token = await new SignJWT({ email: s.email, type: "invite" })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("48h")
        .sign(secret)

      await tx.inviteToken.create({
        data: {
          email: s.email,
          token,
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        },
      })
      // TODO: send invite email via Resend/Postmark
      // The invite link would be: /auth/set-password/${token}
    }

    return c
  })

  return Response.json({ clientId: client.id }, { status: 201 })
}
