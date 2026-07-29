import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"

const tools = [
  {
    href: "/tools/growth-projection",
    title: "Growth Projection",
    blurb: "Model a prospect's revenue forward and show where their delivery capacity caps them out — live.",
  },
  {
    href: "/tools/lead-goal",
    title: "Lead Goal",
    blurb: "Show a prospect how many sales conversations a month it takes to hit their revenue goal — live.",
  },
]

export default async function ToolsHubPage() {
  const session = await auth()
  if (!session) redirect("/auth/signin")
  if (session.user.role !== "coach") redirect("/dashboard")

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 28, fontWeight: 600, margin: "0 0 4px", color: "#1A1916" }}>
          Tools
        </h1>
        <p style={{ fontSize: 13, color: "#9C9590", margin: 0 }}>Interactive versions to drive live on sales calls — nothing is saved.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        {tools.map(t => (
          <Link key={t.href} href={t.href}
            style={{ display: "block", background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 22, textDecoration: "none", color: "inherit" }}>
            <div style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 20, fontWeight: 600, color: "#1A1916", marginBottom: 8 }}>{t.title}</div>
            <p style={{ fontSize: 13, color: "#6F6B64", margin: 0, lineHeight: 1.5 }}>{t.blurb}</p>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#9C9590", marginTop: 14 }}>Open tool →</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
