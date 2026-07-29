import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { type CapacityInputs } from "@/lib/calc"
import LeadDetailClient from "./LeadDetailClient"

export const dynamic = "force-dynamic"

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session) redirect("/auth/signin")
  if (session.user.role !== "coach") redirect("/dashboard")

  const { id } = await params
  const lead = await prisma.capacityLead.findUnique({ where: { id } })
  if (!lead) notFound()

  const parse = (s: string | null): CapacityInputs | null => {
    if (!s) return null
    try { return JSON.parse(s) as CapacityInputs } catch { return null }
  }

  const inputs = parse(lead.inputs)
  if (!inputs) notFound()

  const schedulingUrl =
    process.env.NEXT_PUBLIC_SCHEDULING_URL || "https://www.johnfdoherty.com/growthreviewcall/"

  return (
    <LeadDetailClient
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
        reportSent: lead.reportSent,
        createdAt: lead.createdAt.toISOString(),
      }}
    />
  )
}
