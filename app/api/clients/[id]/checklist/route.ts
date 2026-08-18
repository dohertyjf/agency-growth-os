import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

function authorize(session: import("next-auth").Session | null, clientId: string) {
  if (!session) return false
  if (session.user.role === "coach") return true
  return session.user.clientId === clientId
}

const schema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  dismissed: z.boolean().optional(),
  checkedKeys: z.array(z.string()).optional(),
})

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const { id } = await params
  if (!authorize(session, id)) return Response.json({ error: "Forbidden" }, { status: 403 })

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: "Invalid" }, { status: 422 })
  const { month, dismissed, checkedKeys } = parsed.data

  const update: { dismissed?: boolean; checkedKeys?: string } = {}
  if (dismissed !== undefined) update.dismissed = dismissed
  if (checkedKeys !== undefined) update.checkedKeys = JSON.stringify(checkedKeys)

  const row = await prisma.monthlyChecklist.upsert({
    where: { clientId_month: { clientId: id, month } },
    update,
    create: {
      clientId: id, month,
      dismissed: dismissed ?? false,
      checkedKeys: JSON.stringify(checkedKeys ?? []),
    },
  })
  return Response.json({ dismissed: row.dismissed, checkedKeys: JSON.parse(row.checkedKeys) })
}
