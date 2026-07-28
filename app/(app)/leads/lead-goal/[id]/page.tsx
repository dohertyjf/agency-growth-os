import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import LeadGoalReportClient from "./LeadGoalReportClient"

export const dynamic = "force-dynamic"

interface Inputs {
  currentRevenue: number
  goalRevenue: number
  closeRate: number
  avgDealValue: number
  recurringRevenue: number
  currentLeads: number | null
}

export default async function LeadGoalReportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session) redirect("/auth/signin")
  if (session.user.role !== "coach") redirect("/dashboard")

  const { id } = await params
  const lead = await prisma.leadGoalSubmission.findUnique({ where: { id } })
  if (!lead) notFound()

  const parse = (s: string | null): Inputs | null => {
    if (!s) return null
    try { return JSON.parse(s) as Inputs } catch { return null }
  }

  const inputs = parse(lead.inputs)
  if (!inputs) notFound()

  const schedulingUrl =
    process.env.NEXT_PUBLIC_SCHEDULING_URL || "https://www.johnfdoherty.com/growthreviewcall/"

  return (
    <LeadGoalReportClient
      schedulingUrl={schedulingUrl}
      lead={{
        id: lead.id,
        email: lead.email,
        name: lead.name,
        agency: lead.agency,
        currency: lead.currency,
        inputs,
        adjustedInputs: parse(lead.adjustedInputs),
        takeaways: lead.takeaways,
        scheduled: lead.scheduled,
        createdAt: lead.createdAt.toISOString(),
      }}
    />
  )
}
