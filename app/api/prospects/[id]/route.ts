import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { calcIntake } from "@/lib/calc"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session || session.user.role !== "coach") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const s = await prisma.intakeSubmission.findUnique({ where: { id } })
  if (!s) return Response.json({ error: "Not found" }, { status: 404 })

  const data = JSON.parse(s.data) as Record<string, string[]>
  const answers = JSON.parse(s.answers) as Record<string, string>
  const lastMonth = Object.fromEntries(
    Object.entries(data).map(([k, arr]) => [k, parseFloat(arr[0]) || 0])
  )
  const calc = calcIntake(lastMonth)

  return Response.json({ ...s, data, answers, calc })
}
