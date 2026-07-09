import { NextRequest } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"

const schema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  agency: z.string().optional(),
  data: z.record(z.string(), z.unknown()),
  answers: z.record(z.string(), z.string()),
  honeypot: z.string().max(0).optional(),
})

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return Response.json({ error: "Bad request" }, { status: 400 })

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  if (parsed.data.honeypot) {
    return Response.json({ ok: true }, { status: 201 })
  }

  const { email, name, agency, data, answers } = parsed.data
  const submission = await prisma.intakeSubmission.create({
    data: {
      email,
      name: name ?? null,
      agency: agency ?? null,
      data: JSON.stringify(data),
      answers: JSON.stringify(answers),
    },
  })

  return Response.json({ id: submission.id }, { status: 201 })
}
