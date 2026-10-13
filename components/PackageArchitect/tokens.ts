import type { CSSProperties } from "react"

// August's palette, as used across the rest of the app (inline hex, not
// Tailwind). Kept in one place here so the tool reads as one piece.
export const T = {
  ink: "#1A1916",
  softInk: "#3A3833",
  slate: "#6B6760",
  muted: "#9C9590",
  paper: "#FBFAF7",
  card: "#FFFFFF",
  sunk: "#F5F1EC",
  rule: "#ECE7DE",
  softRule: "#F3EFE8",
  accent: "#E9532A",
  accentDeep: "#C2410C",
  accentTint: "#FBF0EB",
  radius: 8,
  shadow: "0 1px 2px rgba(26,25,22,0.04), 0 6px 20px rgba(26,25,22,0.05)",
} as const

export const serif = "var(--font-cormorant), 'Cormorant Garamond', Georgia, serif"

export const labelStyle: CSSProperties = {
  display: "block", fontSize: 13, fontWeight: 600, color: T.ink, marginBottom: 3,
}
export const helpStyle: CSSProperties = {
  fontSize: 12.5, color: T.slate, lineHeight: 1.45, margin: "0 0 8px",
}
export const inputStyle: CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "10px 12px",
  border: `1px solid ${T.rule}`, borderRadius: T.radius, fontSize: 15,
  lineHeight: 1.5, background: "#FCFBF8", color: T.ink, fontFamily: "inherit",
  outline: "none", resize: "vertical",
}
export const h2Style: CSSProperties = {
  fontFamily: serif, fontSize: 30, fontWeight: 600, lineHeight: 1.1,
  color: T.ink, margin: "0 0 6px", letterSpacing: "-0.01em",
}
export const subheadStyle: CSSProperties = {
  fontSize: 14.5, color: T.slate, margin: "0 0 18px", lineHeight: 1.5,
}
export const bodyStyle: CSSProperties = {
  fontSize: 16, lineHeight: 1.65, color: T.softInk, margin: 0,
}
export const eyebrowStyle: CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
  color: T.muted,
}
export const buttonStyle: CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
  fontSize: 15, fontWeight: 600, color: "#fff", background: T.accent,
  border: "none", borderRadius: T.radius, padding: "13px 24px", cursor: "pointer",
  fontFamily: "inherit", textDecoration: "none", lineHeight: 1.2,
}
export const ghostButtonStyle: CSSProperties = {
  ...buttonStyle, color: T.ink, background: T.card, border: `1px solid ${T.rule}`,
}
export const cardStyle: CSSProperties = {
  background: T.card, border: `1px solid ${T.rule}`, borderRadius: T.radius,
  boxShadow: T.shadow, padding: 20,
}
