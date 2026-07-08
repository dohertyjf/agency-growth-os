"use client"

interface InsightCard {
  tone: "leverage" | "good" | "watch"
  tag: string
  title: string
  body: string
  metric: string
  metricLabel: string
}

interface Props {
  clientId: string
  insights: { enabled: boolean; cards: InsightCard[] }
}

const TONE_STYLES = {
  leverage: { bg: "#FFF7ED", border: "#FDBA74", tag: "#92400E", tagBg: "#FEF3C7", dot: "#F59E0B" },
  good: { bg: "#F0FDF4", border: "#86EFAC", tag: "#166534", tagBg: "#DCFCE7", dot: "#22C55E" },
  watch: { bg: "#EFF6FF", border: "#93C5FD", tag: "#1E40AF", tagBg: "#DBEAFE", dot: "#3B82F6" },
}

export default function InsightsClient({ clientId, insights }: Props) {
  if (!insights.enabled) {
    return (
      <div>
        <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 28, fontWeight: 600, color: "#1A1916", margin: "0 0 20px" }}>Insights</h1>
        <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#1A1916", marginBottom: 8 }}>Insights not yet enabled</div>
          <p style={{ color: "#9C9590", fontSize: 14 }}>Talk to your coach to unlock personalized insights once you have enough data.</p>
        </div>
      </div>
    )
  }

  if (!insights.cards.length) {
    return (
      <div>
        <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 28, fontWeight: 600, color: "#1A1916", margin: "0 0 20px" }}>Insights</h1>
        <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 40, textAlign: "center" }}>
          <div style={{ color: "#9C9590", fontSize: 14 }}>Not enough data yet. Add at least 2 months of metrics to see insights.</div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 28, fontWeight: 600, color: "#1A1916", margin: "0 0 4px" }}>Insights</h1>
        <p style={{ color: "#9C9590", fontSize: 13, margin: 0 }}>Rules-based analysis based on your last 6 months of data.</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {insights.cards.map((card, i) => {
          const style = TONE_STYLES[card.tone]
          return (
            <div key={i} style={{ background: style.bg, border: `1px solid ${style.border}`, borderRadius: 12, padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{
                  fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase",
                  background: style.tagBg, color: style.tag,
                  padding: "3px 8px", borderRadius: 20,
                }}>
                  {card.tag}
                </span>
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: "#1A1916", margin: "0 0 8px", fontFamily: "var(--font-cormorant), serif" }}>
                {card.title}
              </h3>
              <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.6, margin: 0 }}>
                {card.body}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
