"use client"
import type { PAResult } from "@/lib/packageArchitect/types"
import { T, serif, h2Style, subheadStyle, bodyStyle, eyebrowStyle, cardStyle } from "./tokens"
import Ladder from "./Ladder"

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 52 }}>
      <h2 style={h2Style}>{title}</h2>
      {sub && <p style={subheadStyle}>{sub}</p>}
      {!sub && <div style={{ height: 12 }} />}
      {children}
    </section>
  )
}

export default function Result({ r }: { r: PAResult }) {
  return (
    <div>
      <Section title="What you are actually selling">
        <p style={bodyStyle}>{r.read}</p>
        <blockquote style={{
          margin: "22px 0 0", padding: "6px 0 6px 22px", borderLeft: `3px solid ${T.accent}`,
          fontFamily: serif, fontSize: 26, lineHeight: 1.3, fontWeight: 500, color: T.ink,
        }}>
          {r.core}
        </blockquote>
      </Section>

      {r.flag.trim().length > 0 && (
        <Section title="Where the profit is hiding">
          <div style={{ background: T.accentTint, border: `1px solid #F3D2C3`, borderRadius: T.radius, padding: "18px 20px" }}>
            <p style={{ ...bodyStyle, color: T.ink }}>{r.flag}</p>
          </div>
        </Section>
      )}

      <Section
        title="The ladder"
        sub="The middle one is where you want most people. The top one exists to make it look reasonable."
      >
        <Ladder packages={r.packages} />
      </Section>

      <Section title="The arithmetic" sub="How it landed on the middle number. Check it against what you know.">
        <div style={{ ...cardStyle, background: T.sunk, boxShadow: "none" }}>
          <p style={{ ...bodyStyle, fontVariantNumeric: "tabular-nums" }}>{r.priceMath}</p>
        </div>
      </Section>

      <Section title="How to present it">
        <p style={bodyStyle}>{r.present}</p>
        <div style={{ marginTop: 22, ...cardStyle, padding: "18px 20px", borderLeft: `3px solid ${T.ink}` }}>
          <div style={{ ...eyebrowStyle, marginBottom: 8 }}>When they push on price</div>
          <p style={{ ...bodyStyle, fontFamily: serif, fontSize: 20, lineHeight: 1.45, color: T.ink }}>&ldquo;{r.pushback}&rdquo;</p>
        </div>
      </Section>

      <section style={{ marginTop: 52 }} className="pa-two-col">
        <div>
          <h2 style={h2Style}>The desirable downsell</h2>
          <div style={{ height: 12 }} />
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
              <h3 style={{ fontFamily: serif, fontSize: 24, fontWeight: 600, margin: 0, color: T.ink, lineHeight: 1.15 }}>{r.downsell.name}</h3>
              <span style={{ fontFamily: serif, fontSize: 24, fontWeight: 600, color: T.accentDeep }}>{r.downsell.price}</span>
            </div>
            <p style={{ ...bodyStyle, fontSize: 15, marginTop: 12 }}>{r.downsell.what}</p>
            <p style={{ ...bodyStyle, fontSize: 15, marginTop: 12, fontStyle: "italic", color: T.slate }}>&ldquo;{r.downsell.pitch}&rdquo;</p>
          </div>
        </div>
        <div>
          <h2 style={h2Style}>Pull these out</h2>
          <div style={{ height: 12 }} />
          <div style={{ ...cardStyle, padding: 0 }}>
            {r.addons.map((a, i) => (
              <div key={i} style={{ padding: "14px 20px", borderTop: i === 0 ? "none" : `1px solid ${T.softRule}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: T.ink }}>{a.name}</span>
                  <span style={{ fontSize: 15, fontWeight: 600, color: T.accentDeep, whiteSpace: "nowrap" }}>{a.price}</span>
                </div>
                <p style={{ margin: "4px 0 0", fontSize: 13.5, lineHeight: 1.5, color: T.slate }}>{a.why}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Section title="Put teeth in it">
        <p style={bodyStyle}>{r.terms}</p>
      </Section>
    </div>
  )
}
