import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/lib/prisma"

// The Offer Builder home: a client's saved offers plus "New offer".
export default async function OfferBuilderHome() {
  const session = await auth()
  if (!session) redirect("/auth/signin")
  const clientId = session.user.clientId ?? null
  const offers = clientId
    ? await prisma.offer.findMany({ where: { clientId }, orderBy: { updatedAt: "desc" }, select: { id: true, name: true, idealClient: true, current: true, updatedAt: true } })
    : []

  return (
    <div style={{ maxWidth: 960 }}>
      <div style={{ fontSize: 13, color: "#9C9590", marginBottom: 8 }}>
        <Link href="/tools" style={{ color: "#9C9590", textDecoration: "none" }}>Tools</Link>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 30, fontWeight: 600, margin: "0 0 4px", color: "#1A1916" }}>Offer Builder</h1>
          <p style={{ fontSize: 13, color: "#9C9590", margin: 0, maxWidth: 620 }}>Build an offer your Ideal Client can&apos;t ignore. Fill in what you have, get a gap check against the four pillars — Dream Outcome, Proof, Time Delay and What&apos;s Required — then pick the fixes you want and choose from three rebuilt options.</p>
        </div>
        <Link href="/tools/offer-builder/new" style={{ padding: "9px 18px", background: "#E9532A", color: "#fff", borderRadius: 6, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>+ New offer</Link>
      </div>

      {!clientId ? (
        <div style={{ fontSize: 13, color: "#9C9590" }}>Offers are saved to a client profile. You can try the builder here; to save offers, use August as a client. Each client&apos;s saved offers show on their profile&apos;s Offers tab.</div>
      ) : offers.length === 0 ? (
        <div style={{ background: "#fff", border: "1px dashed #E2DCD2", borderRadius: 12, padding: 28, fontSize: 14, color: "#6B6760" }}>No offers yet. Start with one Ideal Client — you can build a separate offer for each one, or for an event.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {offers.map(o => {
            const headline = (o.current as { headline?: string } | null)?.headline
            return (
              <Link key={o.id} href={`/tools/offer-builder/${o.id}`} style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 10, padding: 16, textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#1A1916" }}>{o.name}</div>
                {o.idealClient && <div style={{ fontSize: 12, color: "#9C9590", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>For: {o.idealClient}</div>}
                <div style={{ fontSize: 13, color: "#4A4640", lineHeight: 1.45, flex: 1 }}>{headline || <span style={{ color: "#C0BAB2" }}>Draft — not finished yet</span>}</div>
                <div style={{ fontSize: 11, color: "#C0BAB2" }}>Updated {o.updatedAt.toISOString().slice(0, 10)}</div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
