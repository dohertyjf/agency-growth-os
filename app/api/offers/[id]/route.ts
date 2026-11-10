import { auth } from "@/auth"
import { z } from "zod"
import type { Prisma } from "@/app/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { inputsSchema } from "@/lib/offerBuilder/run"
import { findOffer } from "@/lib/offerBuilder/access"

const versionSchema = z.record(z.string(), z.string().max(4000))

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  if (!(await findOffer(session, id))) return Response.json({ error: "Not found" }, { status: 404 })
  const parsed = z.object({ inputs: inputsSchema.optional(), current: versionSchema.nullable().optional() }).safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: "Invalid" }, { status: 422 })
  const { inputs, current } = parsed.data
  const offer = await prisma.offer.update({
    where: { id },
    data: {
      ...(inputs ? { name: inputs.name, idealClient: inputs.idealClient, inputs: inputs as unknown as Prisma.InputJsonValue } : {}),
      ...(current !== undefined ? { current: (current ?? undefined) as Prisma.InputJsonValue | undefined } : {}),
    },
  })
  return Response.json(offer)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  if (!(await findOffer(session, id))) return Response.json({ error: "Not found" }, { status: 404 })
  await prisma.offer.delete({ where: { id } })
  return new Response(null, { status: 204 })
}
