import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { calcIntake } from "@/lib/calc"

export async function GET() {
  const session = await auth()
  if (!session || session.user.role !== "coach") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const submissions = await prisma.intakeSubmission.findMany({
    orderBy: { createdAt: "desc" },
  })

  const results = submissions.map((s) => {
    const data = JSON.parse(s.data) as Record<string, string[]>
    const lastMonth = Object.fromEntries(
      Object.entries(data).map(([k, arr]) => [k, parseFloat(arr[0]) || 0])
    )
    const calc = calcIntake(lastMonth)
    return {
      id: s.id,
      email: s.email,
      name: s.name,
      agency: s.agency,
      createdAt: s.createdAt,
      converted: s.converted,
      clientId: s.clientId,
      cacLtgp: calc.cacLtgp,
    }
  })

  return Response.json(results)
}
