import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const schema = z.object({
  name: z.string().min(1).optional(),
  monthly: z.number().min(0).optional(),
  start: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  contractedThrough: z.string().regex(/^\d{4}-\d{2}$/).nullable().optional(),
  status: z.enum(["potential", "active", "finished"]).optional(),
  type: z.enum(["retainer", "oneoff"]).optional(),
  accountId: z.string().nullable().optional(),
})

async function authorizeContract(session: import("next-auth").Session | null, contractId: string) {
  if (!session) return null
  const contract = await prisma.contract.findUnique({ where: { id: contractId } })
  if (!contract) return null
  if (session.user.role === "coach") return contract
  if (session.user.clientId === contract.clientId) return contract
  return null
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const session = await auth()
  const { contractId } = await params
  const contract = await authorizeContract(session, contractId)
  if (!contract) return Response.json({ error: "Forbidden or not found" }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: "Invalid" }, { status: 422 })

  const updateData = { ...parsed.data }
  // One-offs: keep contractedThrough pinned to start
  if (updateData.type === "oneoff" || (contract.type === "oneoff" && !updateData.type)) {
    updateData.contractedThrough = updateData.start ?? contract.start
  }

  const updated = await prisma.contract.update({
    where: { id: contractId },
    data: updateData,
  })
  return Response.json(updated)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const session = await auth()
  const { contractId } = await params
  const contract = await authorizeContract(session, contractId)
  if (!contract) return Response.json({ error: "Forbidden or not found" }, { status: 403 })

  await prisma.contract.delete({ where: { id: contractId } })
  return new Response(null, { status: 204 })
}
