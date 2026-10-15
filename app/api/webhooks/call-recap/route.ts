import { prisma } from "@/lib/prisma"
import { createHash, timingSafeEqual } from "node:crypto"
import { z } from "zod"

// Inbound webhook for coaching-call recaps (sent by Zapier after it writes the
// recap). Not session-authenticated: callers must send
//   Authorization: Bearer <RECAP_WEBHOOK_SECRET>
//
// Body (JSON):
//   emails      — attendee email(s): a string (comma/space separated) or array.
//                 The first one that belongs to a client (Client.email or a
//                 client login's email) decides who the call is for.
//   title       — call title, e.g. the Meet event name
//   date        — anything containing YYYY-MM-DD or YYYY/MM/DD
//   recap       — the recap text (stored as the call's Recap / synopsis)
//   transcript  — optional transcript text or link
//   video       — optional recording link
//
// Calls with no matching client (prospects, intro calls) are saved as drafts
// with no client; the coach assigns them on the Calls page. Re-sending the
// same call (same client, date and title) updates it instead of creating a
// duplicate.

const schema = z.object({
  emails: z.union([z.string(), z.array(z.string())]),
  title: z.string().trim().min(1),
  date: z.string().min(1),
  recap: z.string().trim().min(1),
  transcript: z.string().optional(),
  video: z.string().optional(),
})

function secretMatches(header: string | null): boolean {
  const secret = process.env.RECAP_WEBHOOK_SECRET
  if (!secret || !header?.startsWith("Bearer ")) return false
  // Hash both sides so the comparison is constant-time regardless of length.
  const a = createHash("sha256").update(header.slice(7).trim()).digest()
  const b = createHash("sha256").update(secret).digest()
  return timingSafeEqual(a, b)
}

function parseEmails(input: string | string[]): string[] {
  const raw = Array.isArray(input) ? input.join(",") : input
  const found = raw.toLowerCase().match(/[^\s,;<>"']+@[^\s,;<>"']+\.[a-z]{2,}/g) ?? []
  return [...new Set(found)]
}

function parseDate(input: string): string | null {
  const m = input.match(/(\d{4})[-/](\d{2})[-/](\d{2})/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}

const emptyToUndefined = (s?: string) => (s && s.trim() ? s.trim() : undefined)

export async function POST(req: Request) {
  if (!secretMatches(req.headers.get("authorization"))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Invalid", issues: parsed.error.issues }, { status: 422 })
  }
  const { title, recap } = parsed.data
  const transcript = emptyToUndefined(parsed.data.transcript)
  const video = emptyToUndefined(parsed.data.video)

  const date = parseDate(parsed.data.date)
  if (!date) return Response.json({ error: "Could not read a date (need YYYY-MM-DD)" }, { status: 422 })

  const emails = parseEmails(parsed.data.emails)
  if (emails.length === 0) return Response.json({ error: "No email addresses found" }, { status: 422 })

  // Match on the client's own email first, then on any client login's email.
  const [clients, users] = await Promise.all([
    prisma.client.findMany({
      where: { OR: emails.map(e => ({ email: { equals: e, mode: "insensitive" as const } })) },
      select: { id: true, email: true, name: true },
    }),
    prisma.user.findMany({
      where: {
        OR: emails.map(e => ({ email: { equals: e, mode: "insensitive" as const } })),
        role: "client",
        clientId: { not: null },
      },
      select: { email: true, clientId: true, client: { select: { name: true } } },
    }),
  ])

  let clientId: string | null = null
  let clientName = ""
  for (const email of emails) {
    const c = clients.find(c => c.email.toLowerCase() === email)
    if (c) { clientId = c.id; clientName = c.name; break }
    const u = users.find(u => u.email.toLowerCase() === email)
    if (u?.clientId) { clientId = u.clientId; clientName = u.client?.name ?? ""; break }
  }

  // No match → draft (clientId null). A resend only ever updates the same
  // client's call, or an unassigned draft — never another client's call.
  const existing = await prisma.call.findFirst({ where: { clientId, date, title } })
  const data = { synopsis: recap, ...(transcript && { transcript }), ...(video && { video }) }

  const call = existing
    ? await prisma.call.update({ where: { id: existing.id }, data })
    : await prisma.call.create({ data: { clientId, date, title, ...data } })

  return Response.json(
    {
      ok: true,
      action: existing ? "updated" : clientId ? "created" : "drafted",
      callId: call.id,
      client: clientId ? clientName : null,
      date,
      ...(clientId ? {} : { note: "No August client matches these emails; saved as a draft to assign", emails }),
    },
    { status: existing ? 200 : 201 }
  )
}
