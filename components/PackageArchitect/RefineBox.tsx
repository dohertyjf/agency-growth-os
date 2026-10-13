"use client"
import { useState } from "react"
import { T, h2Style, inputStyle, buttonStyle, cardStyle } from "./tokens"
import { LoadingDots } from "./IntakeForm"

interface Props {
  onRefine: (note: string) => void
  busy: boolean
  applied: string[]
}

export default function RefineBox({ onRefine, busy, applied }: Props) {
  const [note, setNote] = useState("")
  const can = !busy && note.trim().length >= 3

  return (
    <section style={{ marginTop: 52 }}>
      <h2 style={h2Style}>Not right? Say what to change</h2>
      <p style={{ fontSize: 14.5, color: T.slate, margin: "0 0 16px", lineHeight: 1.5 }}>
        Plain English. &ldquo;Drop the top tier to 3x.&rdquo; &ldquo;We never do monthly reporting.&rdquo; &ldquo;The buyer is the CFO, not the founder.&rdquo;
        Corrections apply to this run only.
      </p>
      <form onSubmit={e => { e.preventDefault(); if (can) { onRefine(note.trim()); setNote("") } }} style={cardStyle}>
        <textarea
          rows={3}
          value={note}
          onChange={e => setNote(e.target.value)}
          disabled={busy}
          placeholder="What should be different?"
          style={inputStyle}
          aria-label="What to change"
        />
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <button type="submit" disabled={!can} style={{ ...buttonStyle, opacity: can ? 1 : 0.55, cursor: can ? "pointer" : "not-allowed" }}>
            {busy ? <LoadingDots label="Rebuilding" /> : "Rebuild with this change"}
          </button>
          <span style={{ fontSize: 13, color: T.muted }}>Counts as another build.</span>
        </div>
      </form>

      {applied.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted, marginBottom: 8 }}>
            Applied this session
          </div>
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.6, color: T.softInk }}>
            {applied.map((n, i) => <li key={i}>{n}</li>)}
          </ol>
        </div>
      )}
    </section>
  )
}
