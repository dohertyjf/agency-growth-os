import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

async function authorize(session: import("next-auth").Session | null, contractId: string) {
  if (!session) return null
  const contract = await prisma.contract.findUnique({ where: { id: contractId } })
  if (!contract) return null
  if (session.user.role === "coach") return contract
  if (session.user.clientId === contract.clientId) return contract
  return null
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const session = await auth()
  const { contractId } = await params
  if (!(await authorize(session, contractId))) return Response.json({ error: "Forbidden" }, { status: 403 })
  const notes = await prisma.contractNote.findMany({ where: { contractId }, orderBy: { createdAt: "desc" } })
  return Response.json(notes)
}

const schema = z.object({ body: z.string().min(1), kind: z.enum(["note", "transcript"]).default("note") })

export async function POST(
  req: Request,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const session = await auth()
  const { contractId } = await params
  if (!(await authorize(session, contractId))) return Response.json({ error: "Forbidden" }, { status: 403 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: "Invalid" }, { status: 422 })
  const note = await prisma.contractNote.create({
    data: { contractId, body: parsed.data.body, kind: parsed.data.kind, author: session!.user.name ?? null },
  })
  return Response.json(note)
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const session = await auth()
  const { contractId } = await params
  if (!(await authorize(session, contractId))) return Response.json({ error: "Forbidden" }, { status: 403 })
  const noteId = new URL(req.url).searchParams.get("noteId")
  if (!noteId) return Response.json({ error: "noteId required" }, { status: 400 })
  await prisma.contractNote.deleteMany({ where: { id: noteId, contractId } })
  return Response.json({ ok: true })
}
