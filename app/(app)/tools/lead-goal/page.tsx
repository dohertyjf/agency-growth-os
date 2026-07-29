import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import LeadGoalCalculator from "@/components/LeadGoalCalculator"

export default async function LeadGoalLivePage() {
  const session = await auth()
  if (!session) redirect("/auth/signin")
  if (session.user.role !== "coach") redirect("/dashboard")

  return (
    <div>
      <Link href="/tools" style={{ fontSize: 13, color: "#6B6760", textDecoration: "none", display: "inline-block", marginBottom: 8 }}>← All tools</Link>
      <LeadGoalCalculator live />
    </div>
  )
}
