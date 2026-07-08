import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { calcIntake, fmtCurrency, type IntakeData } from "@/lib/calc"
import ProspectsClient from "./ProspectsClient"

export default async function ProspectsPage() {
  const session = await auth()
  if (!session) redirect("/auth/signin")
  if (session.user.role !== "coach") redirect("/dashboard")

  const submissions = await prisma.intakeSubmission.findMany({
    where: { converted: false },
    orderBy: { id: "desc" },
  })

  const prospects = submissions.map(s => {
    let data: IntakeData = {}
    let answers: Record<string, string> = {}
    try { data = JSON.parse(s.data) } catch {}
    try { answers = JSON.parse(s.answers) } catch {}
    const calc = calcIntake(data)
    return { ...s, data, answers, calc }
  })

  return <ProspectsClient prospects={prospects} />
}
