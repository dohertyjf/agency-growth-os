import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const tools = [
  {
    href: "/leads/growth-projection",
    title: "Growth Projection Report",
    blurb: "“When does your agency's growth model cap out?” — capacity ceiling submissions.",
  },
  {
    href: "/leads/lead-goal",
    title: "Lead Goal",
    blurb: "“How many leads do you need to hit your goal?” — lead-plan submissions.",
  },
]

export default async function LeadsHubPage() {
  const session = await auth()
  if (!session) redirect("/auth/signin")
  if (session.user.role !== "coach") redirect("/dashboard")

  const [capacityCount, leadGoalCount] = await Promise.all([
    prisma.capacityLead.count(),
    prisma.leadGoalSubmission.count(),
  ])
  const counts: Record<string, number> = {
    "/leads/growth-projection": capacityCount,
    "/leads/lead-goal": leadGoalCount,
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 28, fontWeight: 600, margin: "0 0 4px", color: "#1A1916" }}>
          Leads
        </h1>
        <p style={{ fontSize: 13, color: "#9C9590", margin: 0 }}>Submissions from your public lead-magnet tools</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        {tools.map(t => (
          <Link key={t.href} href={t.href}
            style={{ display: "block", background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 22, textDecoration: "none", color: "inherit" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
              <div style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 20, fontWeight: 600, color: "#1A1916" }}>{t.title}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#E9532A", fontVariantNumeric: "tabular-nums" }}>{counts[t.href] ?? 0}</div>
            </div>
            <p style={{ fontSize: 13, color: "#6F6B64", margin: 0, lineHeight: 1.5 }}>{t.blurb}</p>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#9C9590", marginTop: 14 }}>View submissions →</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
