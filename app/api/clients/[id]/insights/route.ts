import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { netProfit, netMargin, momDelta } from "@/lib/calc"
import { z } from "zod"

function authorize(session: Awaited<ReturnType<typeof auth>>, clientId: string) {
  if (!session) return false
  if (session.user.role === "coach") return true
  return session.user.clientId === clientId
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const { id } = await params
  if (!authorize(session, id)) return Response.json({ error: "Forbidden" }, { status: 403 })

  const url = new URL(req.url)
  const range = parseInt(url.searchParams.get("range") ?? "6", 10)

  const client = await prisma.client.findUnique({ where: { id } })
  if (!client) return Response.json({ error: "Not found" }, { status: 404 })

  const metrics = await prisma.monthlyMetric.findMany({
    where: { clientId: id },
    orderBy: { month: "desc" },
    take: range,
  })
  metrics.reverse()

  if (metrics.length < 2) {
    return Response.json({ enabled: true, cards: [] })
  }

  const pct = (arr: number[]) => {
    const f = arr[0], l = arr[arr.length - 1]
    return f === 0 ? 0 : Math.round((l - f) / Math.abs(f) * 100)
  }

  const leads = metrics.map(m => m.leads)
  const closeRate = metrics.map(m => m.closeRate)
  const np = metrics.map(m => netProfit(m.revenue, m.totalExpenses))
  const software = metrics.map(m => m.software)
  const nm = metrics.map(m => netMargin(m.revenue, m.totalExpenses))

  const leadsP = pct(leads)
  const closeP = pct(closeRate)
  const npP = pct(np)
  const softP = pct(software)
  const nmPts = Math.round(nm[nm.length - 1] - nm[0])
  const lastLeads = leads[leads.length - 1]

  const cards = [
    {
      tone: "leverage",
      tag: "Highest leverage",
      title: "Tighten sales conversion before buying more traffic",
      body: `Leads grew ${leadsP}% but close rate moved ${closeP}% over the period. At ${lastLeads} leads/mo, lifting close rate just 3 points is worth more revenue than another lead-gen push — and costs nothing.`,
      metric: "closeRate",
      metricLabel: "close rate",
    },
    {
      tone: "good",
      tag: "Working well",
      title: "Net profit is compounding",
      body: `Net profit is up ${npP}% and net margin improved ${nmPts} points. The pricing and delegation moves from recent calls are landing — protect what changed.`,
      metric: "netProfit",
      metricLabel: "net profit",
    },
    {
      tone: "watch",
      tag: "Keep an eye on",
      title: "Watch tooling creep",
      body: `Software spend rose ${softP}% over the period. Audit subscriptions each quarter so fixed costs don't quietly eat into the margin gains.`,
      metric: "software",
      metricLabel: "software spend",
    },
  ]

  return Response.json({ enabled: true, cards })
}

const schema = z.object({ enabled: z.boolean() })

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const { id } = await params
  if (!authorize(session, id)) return Response.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: "Invalid" }, { status: 422 })

  return Response.json({ enabled: parsed.data.enabled })
}
