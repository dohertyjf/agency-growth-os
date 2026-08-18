import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

function authorize(session: import("next-auth").Session | null, clientId: string) {
  if (!session) return false
  if (session.user.role === "coach") return true
  return session.user.clientId === clientId
}

const schema = z.object({ body: z.string().min(1) })

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; accountId: string }> }
) {
  const session = await auth()
  const { id, accountId } = await params
  if (!authorize(session, id)) return Response.json({ error: "Forbidden" }, { status: 403 })

  const account = await prisma.account.findFirst({ where: { id: accountId, clientId: id } })
  if (!account) return Response.json({ error: "Not found" }, { status: 404 })

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: "Invalid" }, { status: 422 })

  const note = await prisma.accountNote.create({
    data: { accountId, body: parsed.data.body, author: session!.user.name ?? null },
  })
  return Response.json(note)
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; accountId: string }> }
) {
  const session = await auth()
  const { id, accountId } = await params
  if (!authorize(session, id)) return Response.json({ error: "Forbidden" }, { status: 403 })

  const noteId = new URL(req.url).searchParams.get("noteId")
  if (!noteId) return Response.json({ error: "noteId required" }, { status: 400 })
  await prisma.accountNote.deleteMany({ where: { id: noteId, accountId } })
  return Response.json({ ok: true })
}
