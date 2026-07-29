import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import CapacityLiveTool from "@/components/CapacityLiveTool"

export default async function GrowthProjectionLivePage() {
  const session = await auth()
  if (!session) redirect("/auth/signin")
  if (session.user.role !== "coach") redirect("/dashboard")

  return (
    <div>
      <Link href="/tools" style={{ fontSize: 13, color: "#6B6760", textDecoration: "none", display: "inline-block", marginBottom: 16 }}>← All tools</Link>
      <CapacityLiveTool />
    </div>
  )
}
