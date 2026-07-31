import { NextRequest } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { leadsGoal, fmtCurrency, type LeadsGoalInputs } from "@/lib/calc"

// Public endpoint — called cross-origin from the embed on hmldin.com.
const ALLOWED_ORIGIN = process.env.ALLOWED_EMBED_ORIGIN || "*"

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() })
}

const inputsSchema = z.object({
  currentRevenue: z.number(),
  goalRevenue: z.number(),
  closeRate: z.number(),          // fraction 0–1
  currentClients: z.number().nullable().optional(),
  avgMonthsStay: z.number().nullable().optional(),
  currentLeads: z.number().nullable().optional(),
  // Legacy fields — still accepted from older embeds so nothing breaks mid-rollout.
  avgDealValue: z.number().optional(),
  recurringRevenue: z.number().optional(),
})

const schema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  agency: z.string().optional(),
  currency: z.enum(["USD", "GBP", "EUR"]).default("USD"),
  inputs: inputsSchema,
  honeypot: z.string().max(0).optional(),
})

async function notifySlack(args: {
  id: string; name?: string; agency?: string; email: string
  currency: string; leadsNeeded: number; goal: number
}) {
  const url = process.env.SLACK_WEBHOOK_URL
  if (!url) return
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ""
  const who = [args.name, args.agency].filter(Boolean).join(" · ") || args.email
  const link = appUrl ? `${appUrl}/leads/lead-goal/${args.id}` : `/leads/lead-goal/${args.id}`
  const text = `📈 New lead-goal submission: *${who}* (${args.email})\nNeeds ~${args.leadsNeeded} leads/mo to hit ${fmtCurrency(args.goal, args.currency)}/mo\n<${link}|Review in Agency Growth OS →>`
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    })
  } catch {
    // Never let a Slack outage break lead capture.
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return Response.json({ error: "Bad request" }, { status: 400, headers: corsHeaders() })

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422, headers: corsHeaders() })
  }

  if (parsed.data.honeypot) {
    return Response.json({ ok: true }, { status: 201, headers: corsHeaders() })
  }

  const { email, name, agency, currency, inputs } = parsed.data
  const result = leadsGoal({ ...inputs, currentLeads: inputs.currentLeads ?? null, months: 12 } as LeadsGoalInputs)

  const lead = await prisma.leadGoalSubmission.create({
    data: {
      email,
      name: name ?? null,
      agency: agency ?? null,
      currency,
      inputs: JSON.stringify(inputs),
      result: JSON.stringify(result),
    },
  })

  await notifySlack({
    id: lead.id, name, agency, email, currency,
    leadsNeeded: Math.ceil(result.leadsToReachGoal),
    goal: inputs.goalRevenue,
  })

  return Response.json({ id: lead.id }, { status: 201, headers: corsHeaders() })
}
