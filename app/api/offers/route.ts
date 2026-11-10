import { auth } from "@/auth"
import { z } from "zod"
import type { Prisma } from "@/app/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { inputsSchema } from "@/lib/offerBuilder/run"

const versionSchema = z.record(z.string(), z.string().max(4000))

// List the signed-in client's offers.
export async function GET() {
  const session = await auth()
  const clientId = session?.user.clientId
  if (!session || !clientId) return Response.json([])
  const offers = await prisma.offer.findMany({ where: { clientId }, orderBy: { updatedAt: "desc" } })
  return Response.json(offers)
}

// Save a new offer for the signed-in client.
export async function POST(req: Request) {
  const session = await auth()
  const clientId = session?.user.clientId
  if (!session || !clientId) return Response.json({ error: "Offers are saved to a client profile — use August as a client to save one." }, { status: 403 })
  const parsed = z.object({ inputs: inputsSchema, current: versionSchema.nullable().optional() }).safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: "Give the offer a name and describe your Ideal Client first." }, { status: 422 })
  const { inputs, current } = parsed.data
  const offer = await prisma.offer.create({
    data: {
      clientId, name: inputs.name, idealClient: inputs.idealClient,
      inputs: inputs as unknown as Prisma.InputJsonValue,
      ...(current ? { current: current as Prisma.InputJsonValue } : {}),
    },
  })
  return Response.json(offer, { status: 201 })
}
