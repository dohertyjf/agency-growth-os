import { NextRequest } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { projectCapacity, fmtCurrency, ymLabel, ymAdd, type CapacityInputs } from "@/lib/calc"

// Public endpoint — called cross-origin from the embed on johnfdoherty.com.
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
  startRevenue: z.number(),
  leads: z.number(),
  closeRate: z.number(),
  avgDeal: z.number(),
  churn: z.number(),
  hoursPerClient: z.number(),
  billableHours: z.number(),
  activeClients: z.number(),
  goalMRR: z.number().nullable().optional(),
})

const schema = z.object({
  email: z.string().trim().email(),
  name: z.string().optional(),
  agency: z.string().optional(),
  currency: z.enum(["USD", "GBP", "EUR"]).default("USD"),
  inputs: inputsSchema,
  honeypot: z.string().max(0).optional(),
})

async function notifySlack(args: {
  id: string | null; name?: string; agency?: string; email: string
  currency: string; capMonthLabel: string | null; mrrCap: number | null
}) {
  const url = process.env.SLACK_WEBHOOK_URL
  if (!url) return
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ""
  const who = [args.name, args.agency].filter(Boolean).join(" · ") || args.email
  const ceiling = args.mrrCap != null ? fmtCurrency(args.mrrCap, args.currency) : "no capacity ceiling set"
  const capLine = args.capMonthLabel
    ? `Caps out ${args.capMonthLabel} at ${ceiling}`
    : `Ceiling: ${ceiling}`
  // When the DB write failed there's no record to link to — flag it so the
  // lead can be captured manually instead of quietly lost.
  const link = args.id ? (appUrl ? `${appUrl}/leads/growth-projection/${args.id}` : `/leads/growth-projection/${args.id}`) : null
  const reviewLine = link
    ? `\n<${link}|Review in Agency Growth OS →>`
    : `\n⚠️ Not saved to the database — capture this lead manually.`
  const text = `🎯 New capacity calculator lead: *${who}* (${args.email})\n${capLine}${reviewLine}`
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

  // Honeypot: pretend success without storing.
  if (parsed.data.honeypot) {
    return Response.json({ ok: true }, { status: 201, headers: corsHeaders() })
  }

  const { email, name, agency, currency, inputs } = parsed.data
  const result = projectCapacity(inputs as CapacityInputs)

  // Persist the lead. If the write fails (e.g. the database is unreachable),
  // log it and fall through — we still notify Slack so the lead isn't lost.
  let lead: { id: string } | null = null
  try {
    lead = await prisma.capacityLead.create({
      data: {
        email,
        name: name ?? null,
        agency: agency ?? null,
        currency,
        inputs: JSON.stringify(inputs),
        result: JSON.stringify(result),
      },
    })
  } catch (err) {
    console.error("capacity lead: failed to persist submission", err)
  }

  const now = new Date().toISOString().slice(0, 7)
  const capMonthLabel = result.capacityHitMonth >= 0
    ? ymLabel(ymAdd(now, result.capacityHitMonth + 1))
    : null

  await notifySlack({
    id: lead?.id ?? null, name, agency, email, currency,
    capMonthLabel, mrrCap: result.mrrCap,
  })

  return Response.json({ id: lead?.id ?? null, saved: lead != null }, { status: 201, headers: corsHeaders() })
}
