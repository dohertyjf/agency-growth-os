"use client"
import type { PAIntake } from "@/lib/packageArchitect/types"
import { T, labelStyle, helpStyle, inputStyle, buttonStyle, cardStyle } from "./tokens"

interface Props {
  value: PAIntake
  onChange: (next: PAIntake) => void
  onSubmit: () => void
  busy: boolean
  minSource: number
  maxTotal: number
  honeypot: string
  onHoneypot: (v: string) => void
}

type Field = {
  id: keyof PAIntake
  label: string
  help: string
  kind: "textarea" | "text"
  rows?: number
}

const FIELDS: Field[] = [
  { id: "source", label: "Paste a past proposal, or describe the work", kind: "textarea", rows: 10,
    help: "Deliverables, scope, meetings, timelines, anything you promised. Strip out client names if you like." },
  { id: "who", label: "Who buys this?", kind: "textarea", rows: 3,
    help: "Company type, revenue, and the person who signs." },
  { id: "outcome", label: "What number do they care about?", kind: "textarea", rows: 3,
    help: "The result, not the deliverable. If there is no direct revenue line, name the number they watch that they believe drives revenue." },
  { id: "price", label: "What do you charge now?", kind: "text",
    help: "Optional, but a number here makes the pricing far sharper." },
  { id: "worth", label: "What is a typical buyer worth?", kind: "text",
    help: "Their revenue, and what this work is worth to them if it lands. This is what the prices get anchored to." },
  { id: "ceiling", label: "Rules the packages must respect", kind: "text",
    help: "Hard constraints, not preferences. Work you refuse, capacity limits, a price you will not go under. Nothing in the output will contradict what you put here." },
]

export default function IntakeForm({ value, onChange, onSubmit, busy, minSource, maxTotal, honeypot, onHoneypot }: Props) {
  const sourceLen = value.source.length
  const total = (Object.values(value) as string[]).reduce((n, s) => n + (s?.length ?? 0), 0)
  const tooShort = sourceLen < minSource
  const tooLong = total > maxTotal
  const canSubmit = !busy && !tooShort && !tooLong

  function set(id: keyof PAIntake, v: string) { onChange({ ...value, [id]: v }) }

  return (
    <form
      onSubmit={e => { e.preventDefault(); if (canSubmit) onSubmit() }}
      style={{ ...cardStyle, position: "relative", padding: "clamp(18px, 3vw, 28px)" }}
    >
      <p style={{ fontSize: 15, lineHeight: 1.6, color: T.softInk, margin: "0 0 22px", paddingBottom: 18, borderBottom: `1px solid ${T.softRule}` }}>
        The messier the better. Old proposals, scope docs, a rambling paragraph about what you actually do.
        This works off what you have really sold, not what you wish you sold.
      </p>

      <div style={{ display: "grid", gap: 20 }}>
        {FIELDS.map(f => {
          const v = value[f.id] ?? ""
          const isSource = f.id === "source"
          return (
            <div key={f.id}>
              <label htmlFor={`pa-${f.id}`} style={labelStyle}>
                {f.label}{isSource && <span style={{ color: T.accent, marginLeft: 4 }}>*</span>}
              </label>
              <p style={helpStyle}>{f.help}</p>
              {f.kind === "textarea" ? (
                <textarea
                  id={`pa-${f.id}`}
                  rows={f.rows}
                  value={v}
                  onChange={e => set(f.id, e.target.value)}
                  style={inputStyle}
                  disabled={busy}
                  required={isSource}
                  aria-describedby={isSource ? "pa-source-count" : undefined}
                />
              ) : (
                <input
                  id={`pa-${f.id}`}
                  type="text"
                  value={v}
                  onChange={e => set(f.id, e.target.value)}
                  style={inputStyle}
                  disabled={busy}
                  autoComplete="off"
                />
              )}
              {isSource && (
                <div id="pa-source-count" style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.muted, marginTop: 6 }}>
                  <span>{tooShort && sourceLen > 0 ? `${minSource - sourceLen} more characters to go` : " "}</span>
                  <span style={{ color: tooLong ? T.accentDeep : T.muted, fontVariantNumeric: "tabular-nums" }}>
                    {sourceLen.toLocaleString()} characters
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Honeypot: hidden from people, filled by bots. */}
      <div aria-hidden="true" style={{ position: "absolute", left: -9999, top: -9999, height: 0, overflow: "hidden" }}>
        <label>Website<input type="text" tabIndex={-1} autoComplete="off" value={honeypot} onChange={e => onHoneypot(e.target.value)} /></label>
      </div>

      <div style={{ marginTop: 24, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14 }}>
        <button type="submit" disabled={!canSubmit} style={{ ...buttonStyle, opacity: canSubmit ? 1 : 0.55, cursor: canSubmit ? "pointer" : "not-allowed", minWidth: 200 }}>
          {busy ? <LoadingDots label="Reading what you sell" /> : "Build my package ladder"}
        </button>
        {tooLong && (
          <span style={{ fontSize: 13, color: T.accentDeep }}>
            That is too long to send. Paste the scope and pricing sections only.
          </span>
        )}
        {!tooLong && !busy && (
          <span style={{ fontSize: 13, color: T.muted }}>Takes 20 to 40 seconds. Nothing you paste is stored.</span>
        )}
      </div>
    </form>
  )
}

export function LoadingDots({ label }: { label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <span className="pa-dots" aria-hidden="true">
        <i /><i /><i />
      </span>
      <span>{label}</span>
    </span>
  )
}
