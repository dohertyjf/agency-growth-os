"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import type { PAIntake, PAResult, PAErrorCode, PAStreamLine } from "@/lib/packageArchitect/types"
import { T, serif, h2Style, bodyStyle, buttonStyle, ghostButtonStyle, inputStyle, cardStyle } from "./tokens"
import IntakeForm, { LoadingDots } from "./IntakeForm"
import Result from "./Result"
import RefineBox from "./RefineBox"

interface Props {
  ctaUrl: string
  minSource: number
  maxTotal: number
  // Inside the logged-in app shell: no full-page background, tighter padding,
  // and no sales CTA (they are already a client).
  embedded?: boolean
}

const EMPTY: PAIntake = { source: "", who: "", outcome: "", price: "", worth: "", ceiling: "" }

// Plain-English copy per error code. The code itself is never shown.
const ERROR_COPY: Record<PAErrorCode, string> = {
  too_long: "That is too long to send. Paste the scope and pricing sections only.",
  too_short: "Give it a little more to go on. A few sentences about what you actually deliver is enough.",
  bad_request: "Something went wrong. Try again.",
  rate_limited: "You have hit the limit for now. Come back in an hour, or book a call and I will do this with you.",
  malformed: "That came back incomplete. Try again, or give it a bit less.",
  unavailable: "Something went wrong. Try again.",
  error: "Something went wrong. Try again.",
}

class PAClientError extends Error {
  code: PAErrorCode
  constructor(code: PAErrorCode) { super(code); this.code = code }
}

// POST, then read the NDJSON stream until a terminal line arrives. Non-2xx
// responses carry a JSON error body and a real status (413, 429, ...).
async function callRoute(path: string, body: unknown, signal: AbortSignal): Promise<PAResult> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) {
    const j = await res.json().catch(() => ({})) as { error?: PAErrorCode }
    throw new PAClientError(j.error ?? "error")
  }
  if (!res.body) throw new PAClientError("error")

  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ""
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let nl: number
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (!line) continue
      let msg: PAStreamLine
      try { msg = JSON.parse(line) } catch { continue }
      if (msg.type === "result") return msg.data
      if (msg.type === "error") throw new PAClientError(msg.error)
    }
  }
  throw new PAClientError("error")
}

export default function PackageArchitect({ ctaUrl, minSource, maxTotal, embedded = false }: Props) {
  const [intake, setIntake] = useState<PAIntake>(EMPTY)
  const [honeypot, setHoneypot] = useState("")
  const [result, setResult] = useState<PAResult | null>(null)
  const [busy, setBusy] = useState<"build" | "refine" | null>(null)
  const [error, setError] = useState<PAErrorCode | null>(null)
  const [applied, setApplied] = useState<string[]>([])
  const [preparedFor, setPreparedFor] = useState("")
  const [pdfBusy, setPdfBusy] = useState(false)
  const resultRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  const run = useCallback(async (kind: "build" | "refine", note?: string) => {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setBusy(kind)
    setError(null)
    try {
      const data = kind === "build"
        ? await callRoute("/api/package-architect/build", { ...intake, honeypot }, ac.signal)
        : await callRoute("/api/package-architect/refine", { intake, previous: result, note, honeypot }, ac.signal)
      setResult(data)
      if (kind === "build") setApplied([])
      else if (note) setApplied(prev => [...prev, note])
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))
    } catch (err) {
      if ((err as Error).name === "AbortError") return
      setError(err instanceof PAClientError ? err.code : "error")
    } finally {
      if (abortRef.current === ac) setBusy(null)
    }
  }, [intake, honeypot, result])

  async function exportPdf() {
    if (!result) return
    setPdfBusy(true)
    try {
      const { downloadLadderPdf } = await import("./pdf")
      await downloadLadderPdf(result, preparedFor)
    } finally {
      setPdfBusy(false)
    }
  }

  return (
    <div style={embedded ? { color: T.ink } : { minHeight: "100vh", background: T.paper, color: T.ink }}>
      <style>{`
        .pa-wrap { max-width: 920px; margin: 0 auto; padding: 44px 20px 80px; }
        .pa-wrap.pa-embedded { margin: 0; padding: 0 0 40px; }
        .pa-ladder { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; align-items: stretch; padding-top: 22px; }
        .pa-card { min-width: 0; }
        .pa-card-hero { transform: translateY(-22px); }
        .pa-two-col { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 24px; align-items: start; }
        .pa-dots { display: inline-flex; gap: 4px; align-items: center; }
        .pa-dots i { width: 6px; height: 6px; border-radius: 50%; background: currentColor; opacity: 0.35; animation: pa-pulse 1.2s ease-in-out infinite; }
        .pa-dots i:nth-child(2) { animation-delay: 0.2s; }
        .pa-dots i:nth-child(3) { animation-delay: 0.4s; }
        @keyframes pa-pulse { 0%, 80%, 100% { opacity: 0.3; transform: scale(0.85); } 40% { opacity: 1; transform: scale(1); } }
        .pa-pdf-row { display: flex; gap: 10px; align-items: stretch; flex-wrap: wrap; }
        .pa-pdf-row input { flex: 1 1 220px; }
        @media (max-width: 760px) {
          .pa-wrap { padding: 28px 16px 64px; }
          .pa-wrap.pa-embedded { padding: 0 0 32px; }
          .pa-ladder { grid-template-columns: 1fr; padding-top: 0; gap: 14px; }
          .pa-card-hero { transform: none; }
          .pa-two-col { grid-template-columns: 1fr; gap: 40px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .pa-dots i { animation: none; opacity: 0.7; }
          .pa-card-hero { transform: none; }
        }
      `}</style>

      <div className={embedded ? "pa-wrap pa-embedded" : "pa-wrap"}>
        <header style={{ marginBottom: 30 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: T.accentDeep, marginBottom: 12 }}>
            Package Architect
          </div>
          <h1 style={{ fontFamily: serif, fontSize: "clamp(34px, 6vw, 50px)", fontWeight: 600, lineHeight: 1.05, margin: "0 0 14px", letterSpacing: "-0.015em", color: T.ink }}>
            Turn what you already sell into a package ladder people pay more for.
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.55, color: T.softInk, margin: 0, maxWidth: 640 }}>
            Paste a proposal or describe the work. You get three tiers with prices, a paid front end,
            the add-ons to pull out, the arithmetic behind the middle number, and the words to say when someone pushes on price.
          </p>
        </header>

        <IntakeForm
          value={intake}
          onChange={setIntake}
          onSubmit={() => run("build")}
          busy={busy === "build"}
          minSource={minSource}
          maxTotal={maxTotal}
          honeypot={honeypot}
          onHoneypot={setHoneypot}
        />

        {error && (
          <div role="alert" style={{ marginTop: 18, padding: "14px 18px", borderRadius: T.radius, background: T.accentTint, border: "1px solid #F3D2C3", color: T.ink, fontSize: 15, lineHeight: 1.5 }}>
            {ERROR_COPY[error]}
            {error === "rate_limited" && (
              <>{" "}<a href={ctaUrl} target="_blank" rel="noopener noreferrer" style={{ color: T.accentDeep, fontWeight: 600 }}>Book a strategy call →</a></>
            )}
          </div>
        )}

        {busy === "build" && !result && (
          <div style={{ marginTop: 28, textAlign: "center", color: T.slate, fontSize: 15 }}>
            <LoadingDots label="Reading what you sell" />
            <div style={{ fontSize: 13, color: T.muted, marginTop: 8 }}>Usually 20 to 40 seconds.</div>
          </div>
        )}

        {result && (
          <div ref={resultRef} style={{ scrollMarginTop: 24, opacity: busy ? 0.55 : 1, transition: "opacity 200ms" }} aria-busy={!!busy}>
            <Result r={result} />

            <RefineBox onRefine={note => run("refine", note)} busy={busy === "refine"} applied={applied} />

            <section style={{ marginTop: 44, ...cardStyle }}>
              <h2 style={{ ...h2Style, fontSize: 24 }}>Take the ladder with you</h2>
              <p style={{ fontSize: 14, color: T.slate, margin: "0 0 14px", lineHeight: 1.5 }}>
                The PDF has the three packages, the starting engagement, the add-on prices and the terms.
                The coaching notes, the arithmetic and the pushback script stay here on the page.
              </p>
              <div className="pa-pdf-row">
                <input
                  type="text"
                  value={preparedFor}
                  onChange={e => setPreparedFor(e.target.value)}
                  placeholder="Prepared for (your agency name, optional)"
                  style={{ ...inputStyle, resize: "none" }}
                  aria-label="Prepared for"
                />
                <button type="button" onClick={exportPdf} disabled={pdfBusy || !!busy} style={{ ...ghostButtonStyle, whiteSpace: "nowrap" }}>
                  {pdfBusy ? <LoadingDots label="Building PDF" /> : "Download the PDF"}
                </button>
              </div>
            </section>

            {!embedded && (
            <section style={{ marginTop: 56, padding: "clamp(28px, 5vw, 44px)", background: T.ink, color: "#fff", borderRadius: T.radius, textAlign: "center" }}>
              <h2 style={{ fontFamily: serif, fontSize: "clamp(28px, 5vw, 38px)", fontWeight: 600, lineHeight: 1.1, margin: "0 0 14px", color: "#fff" }}>
                Packages are easy. Charging for them is the hard part
              </h2>
              <p style={{ ...bodyStyle, color: "#D9D3CB", maxWidth: 560, margin: "0 auto 24px" }}>
                The gap between what you should charge and what you actually ask for is where the money goes missing.
                That gap is a conversation, not a spreadsheet.
              </p>
              <a href={ctaUrl} target="_blank" rel="noopener noreferrer" style={{ ...buttonStyle, fontSize: 16, padding: "14px 28px" }}>
                Book a strategy call →
              </a>
            </section>
            )}
          </div>
        )}

        <footer style={{ marginTop: 56, paddingTop: 20, borderTop: `1px solid ${T.rule}`, fontSize: 13, lineHeight: 1.6, color: T.muted }}>
          Built on John&rsquo;s own packaging and pricing framework. Prices are a starting point for a conversation, not a valuation.
          Nothing you paste is stored.
        </footer>
      </div>
    </div>
  )
}
