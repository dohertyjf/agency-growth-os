import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

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

  const lead = await prisma.capacityLead.update({ where: { id }, data })
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
  await prisma.capacityLead.delete({ where: { id } })
  return Response.json({ ok: true })
}
