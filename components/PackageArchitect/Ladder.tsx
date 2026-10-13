"use client"
import type { PAPackage } from "@/lib/packageArchitect/types"
import { T, serif, eyebrowStyle } from "./tokens"

// Three cards. Desktop: staggered baseline so the middle reads as the hero.
// Mobile: a plain stack. The stagger lives in CSS (see index.tsx) because
// inline styles cannot express the breakpoint.
export default function Ladder({ packages }: { packages: PAPackage[] }) {
  return (
    <div className="pa-ladder">
      {packages.map((p, i) => <Card key={p.rank} pkg={p} hero={i === 1} />)}
    </div>
  )
}

function Card({ pkg, hero }: { pkg: PAPackage; hero: boolean }) {
  return (
    <article
      className={hero ? "pa-card pa-card-hero" : "pa-card"}
      style={{
        background: T.card,
        border: `1px solid ${hero ? T.accent : T.rule}`,
        boxShadow: hero ? `0 0 0 1px ${T.accent}, ${T.shadow}` : T.shadow,
        borderRadius: T.radius,
        padding: "22px 20px 20px",
        display: "flex", flexDirection: "column", gap: 14,
        position: "relative",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ ...eyebrowStyle, color: hero ? T.accentDeep : T.muted }}>{pkg.rank}</span>
        <span style={{ fontSize: 12, color: T.muted, fontVariantNumeric: "tabular-nums" }}>{pkg.share} of buyers</span>
      </div>

      <div>
        <h3 style={{ fontFamily: serif, fontSize: 26, fontWeight: 600, lineHeight: 1.1, color: T.ink, margin: "0 0 6px" }}>{pkg.name}</h3>
        <p style={{ fontSize: 14, color: T.slate, margin: 0, lineHeight: 1.45 }}>{pkg.tagline}</p>
      </div>

      <div style={{ padding: "12px 0", borderTop: `1px solid ${T.softRule}`, borderBottom: `1px solid ${T.softRule}` }}>
        <div style={{ fontFamily: serif, fontSize: 34, fontWeight: 600, lineHeight: 1, color: hero ? T.accentDeep : T.ink }}>{pkg.price}</div>
        <div style={{ fontSize: 13, color: T.slate, marginTop: 5 }}>{pkg.term}</div>
      </div>

      <Block title="Right for">
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: T.softInk }}>{pkg.forWho}</p>
      </Block>

      <Block title="Includes">
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.55, color: T.softInk }}>
          {pkg.includes.map((x, i) => <li key={i}>{x}</li>)}
        </ul>
      </Block>

      <Block title="Not included">
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.5, color: T.muted }}>
          {pkg.excludes.map((x, i) => <li key={i}>{x}</li>)}
        </ul>
      </Block>

      <p style={{ margin: "auto 0 0", paddingTop: 6, fontSize: 13.5, lineHeight: 1.5, color: T.slate, fontStyle: "italic" }}>{pkg.logic}</p>
    </article>
  )
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ ...eyebrowStyle, marginBottom: 5 }}>{title}</div>
      {children}
    </div>
  )
}
