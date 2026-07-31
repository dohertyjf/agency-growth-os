import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const inputsSchema = z.object({
  currentRevenue: z.number(),
  goalRevenue: z.number(),
  closeRate: z.number(),
  currentClients: z.number().nullable().optional(),
  avgMonthsStay: z.number().nullable().optional(),
  currentLeads: z.number().nullable().optional(),
  // Legacy fields — kept so older submissions can still be adjusted and saved.
  avgDealValue: z.number().optional(),
  recurringRevenue: z.number().optional(),
})

const schema = z.object({
  adjustedInputs: inputsSchema.nullable().optional(),
  takeaways: z.string().nullable().optional(),
  scheduled: z.boolean().optional(),
  reportSent: z.boolean().optional(),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session || session.user.role !== "coach") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 422 })

  const data: { adjustedInputs?: string | null; takeaways?: string | null; scheduled?: boolean; reportSent?: boolean } = {}
  if (parsed.data.adjustedInputs !== undefined) {
    data.adjustedInputs = parsed.data.adjustedInputs ? JSON.stringify(parsed.data.adjustedInputs) : null
  }
  if (parsed.data.takeaways !== undefined) data.takeaways = parsed.data.takeaways
  if (parsed.data.scheduled !== undefined) data.scheduled = parsed.data.scheduled
  if (parsed.data.reportSent !== undefined) data.reportSent = parsed.data.reportSent

  const lead = await prisma.leadGoalSubmission.update({ where: { id }, data })
  return Response.json({ id: lead.id })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session || session.user.role !== "coach") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }
  const { id } = await params
  await prisma.leadGoalSubmission.delete({ where: { id } })
  return Response.json({ ok: true })
}
