import Link from "next/link"

export interface OfferSummary { id: string; name: string; idealClient: string | null; headline: string | null; updatedAt: string }

// Client profile → Offers: the offers this client has built in the Offer Builder.
export default function OffersPanel({ offers, isCoach }: { offers: OfferSummary[]; isCoach: boolean }) {
  return (
    <div>
      <p style={{ fontSize: 13, color: "#9C9590", margin: "0 0 16px", maxWidth: 640 }}>
        Offers built in the <Link href="/tools/offer-builder" style={{ color: "#E9532A" }}>Offer Builder</Link> — one per Ideal Client, or for an event.
        {isCoach && " Clients create and edit these themselves; use August as this client to change one."}
      </p>
      {offers.length === 0 ? (
        <div style={{ background: "#fff", border: "1px dashed #E2DCD2", borderRadius: 12, padding: 24, fontSize: 14, color: "#6B6760" }}>No offers yet.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
          {offers.map(o => (
            <Link key={o.id} href={`/tools/offer-builder/${o.id}`} style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 10, padding: 16, textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#1A1916" }}>{o.name}</div>
              {o.idealClient && <div style={{ fontSize: 12, color: "#9C9590" }}>For: {o.idealClient}</div>}
              <div style={{ fontSize: 13, color: "#4A4640", lineHeight: 1.45, flex: 1 }}>{o.headline || <span style={{ color: "#C0BAB2" }}>Draft — not finished yet</span>}</div>
              <div style={{ fontSize: 11, color: "#C0BAB2" }}>Updated {o.updatedAt.slice(0, 10)}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
