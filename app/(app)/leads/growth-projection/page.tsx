import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { fmtCurrency, type CapacityResult } from "@/lib/calc"
import DeleteLeadButton from "@/components/DeleteLeadButton"

export const dynamic = "force-dynamic"

export default async function LeadsPage() {
  const session = await auth()
  if (!session) redirect("/auth/signin")
  if (session.user.role !== "coach") redirect("/dashboard")

  const leads = await prisma.capacityLead.findMany({ orderBy: { createdAt: "desc" } })

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Link href="/leads" style={{ fontSize: 13, color: "#6B6760", textDecoration: "none" }}>← All lead tools</Link>
        <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 28, fontWeight: 600, margin: "8px 0 4px", color: "#1A1916" }}>
          Growth Projection Report submissions
        </h1>
        <p style={{ fontSize: 13, color: "#9C9590", margin: 0 }}>
          {leads.length} submission{leads.length === 1 ? "" : "s"} from the public capacity calculator
        </p>
      </div>

      {leads.length === 0 ? (
        <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 40, textAlign: "center", color: "#9C9590", fontSize: 14 }}>
          No leads yet. Submissions from the public calculator will appear here.
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, overflow: "hidden" }}>
          {leads.map((lead, i) => {
            let result: CapacityResult | null = null
            try { result = JSON.parse(lead.result) as CapacityResult } catch { /* ignore */ }
            const ceiling = result?.mrrCap != null ? fmtCurrency(result.mrrCap, lead.currency) : "—"
            return (
              <div key={lead.id} style={{ display: "flex", alignItems: "center", borderTop: i === 0 ? "none" : "1px solid #F1ECE3" }}>
                <Link href={`/leads/growth-projection/${lead.id}`}
                  style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 18px", textDecoration: "none", color: "inherit", flex: 1, minWidth: 0 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1A1916" }}>
                      {lead.name || lead.email}{lead.agency ? <span style={{ color: "#9C9590", fontWeight: 400 }}> · {lead.agency}</span> : null}
                    </div>
                    <div style={{ fontSize: 12, color: "#9C9590", marginTop: 2 }}>{lead.email}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#E9532A", fontVariantNumeric: "tabular-nums" }}>{ceiling}</div>
                    <div style={{ fontSize: 11, color: "#9C9590" }}>ceiling</div>
                  </div>
                  <div style={{ fontSize: 12, color: "#9C9590", flexShrink: 0, width: 90, textAlign: "right" }}>
                    {new Date(lead.createdAt).toLocaleDateString()}
                  </div>
                  {lead.scheduled && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#1F7A4D", background: "#E8F3EC", borderRadius: 4, padding: "2px 6px", flexShrink: 0 }}>BOOKED</span>
                  )}
                </Link>
                <div style={{ padding: "0 14px", flexShrink: 0 }}>
                  <DeleteLeadButton endpoint={`/api/leads/${lead.id}`} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
