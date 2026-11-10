"use client"
import { useState } from "react"
import Link from "next/link"
import {
  OFFER_FIELDS, emptyFields, fieldLabel,
  type GapCheck, type OfferFix, type OfferInputs, type OfferOption, type OfferVersion,
} from "@/lib/offerBuilder/fields"

type Step = "form" | "gaps" | "options" | "final"

const card: React.CSSProperties = { background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 22 }
const input: React.CSSProperties = { width: "100%", padding: "8px 12px", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 14, background: "#fff", color: "#1A1916", boxSizing: "border-box", fontFamily: "inherit", lineHeight: 1.5 }
const label: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 700, color: "#1A1916", marginBottom: 4 }
const hint: React.CSSProperties = { fontSize: 12, color: "#9C9590", marginBottom: 6 }
const primary: React.CSSProperties = { padding: "9px 20px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: "pointer" }
const ghost: React.CSSProperties = { padding: "9px 16px", background: "#fff", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 14, color: "#4A4640", cursor: "pointer" }
const sectionLabel: React.CSSProperties = { fontSize: 10, color: "#9C9590", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }

const STEPS: { key: Step; label: string }[] = [
  { key: "form", label: "Your offer" }, { key: "gaps", label: "Gap check" }, { key: "options", label: "3 options" }, { key: "final", label: "Final version" },
]

export interface SavedOffer { id: string; inputs: OfferInputs; current: OfferVersion | null }

export default function OfferBuilder({ saved, canSave }: { saved: SavedOffer | null; canSave: boolean }) {
  // Improving a saved offer starts from its latest version, not the first draft.
  const start: OfferInputs = saved
    ? { ...saved.inputs, ...(saved.current ? stripHeadline(saved.current) : {}) }
    : { name: "", idealClient: "", ...emptyFields() }

  const [offerId, setOfferId] = useState<string | null>(saved?.id ?? null)
  const [step, setStep] = useState<Step>(saved?.current ? "final" : "form")
  const [inputs, setInputs] = useState<OfferInputs>(start)
  const [check, setCheck] = useState<GapCheck | null>(null)
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [feedback, setFeedback] = useState("")
  const [options, setOptions] = useState<OfferOption[] | null>(null)
  const [final, setFinal] = useState<OfferVersion | null>(saved?.current ?? null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const set = (patch: Partial<OfferInputs>) => setInputs(prev => ({ ...prev, ...patch }))
  const ready = inputs.name.trim() && inputs.idealClient.trim()

  async function post<T>(url: string, body: unknown, what: string): Promise<T | null> {
    setBusy(what); setError(null)
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      if (!res.ok) { const data = await res.json().catch(() => ({})); setError(data.error ?? "Something went wrong — try again."); return null }
      // NDJSON stream: heartbeat lines, then one result or error line.
      const text = await res.text()
      const last = text.trim().split("\n").map(l => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean).pop()
      if (last?.type === "result") return last.data as T
      setError(last?.type === "error" ? last.error : "The connection dropped before it finished — try again."); return null
    } catch {
      setError("Couldn't reach the server — check your connection and try again."); return null
    } finally { setBusy(null) }
  }

  async function runCheck() {
    const data = await post<GapCheck>("/api/tools/offer-builder/gap-check", { inputs }, "Checking your offer against the four pillars… (about 30 seconds)")
    if (!data) return
    setCheck(data); setChosen(new Set(data.fixes.map(f => f.id))); setStep("gaps")
  }

  async function buildOptions() {
    const fixes: OfferFix[] = (check?.fixes ?? []).filter(f => chosen.has(f.id))
    const data = await post<{ options: OfferOption[] }>("/api/tools/offer-builder/options", { inputs, fixes, feedback }, "Building three options… (about 45 seconds)")
    if (!data) return
    setOptions(data.options); setStep("options")
  }

  async function save() {
    if (!final) return
    setBusy("Saving…"); setError(null)
    const body = JSON.stringify({ inputs, current: final })
    const res = await fetch(offerId ? `/api/offers/${offerId}` : "/api/offers", { method: offerId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body })
    const data = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok) { setError(data.error ?? "Couldn't save — try again."); return }
    if (!offerId) { setOfferId(data.id); window.history.replaceState(null, "", `/tools/offer-builder/${data.id}`) }
    setSavedAt(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }))
  }

  const stepIndex = STEPS.findIndex(s => s.key === step)

  return (
    <div style={{ maxWidth: 1080 }}>
      <div style={{ fontSize: 13, color: "#9C9590", marginBottom: 8 }}>
        <Link href="/tools" style={{ color: "#9C9590", textDecoration: "none" }}>Tools</Link>
        {" / "}<Link href="/tools/offer-builder" style={{ color: "#9C9590", textDecoration: "none" }}>Offer Builder</Link>
      </div>
      <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 30, fontWeight: 600, margin: "0 0 14px", color: "#1A1916" }}>{inputs.name.trim() || "New offer"}</h1>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
        {STEPS.map((s, i) => (
          <span key={s.key} style={{ fontSize: 12, padding: "4px 12px", borderRadius: 20, border: `1px solid ${i === stepIndex ? "#E9532A" : "#ECE7DE"}`, background: i === stepIndex ? "#FDF1EC" : i < stepIndex ? "#F5F1EC" : "#fff", color: i === stepIndex ? "#E9532A" : i < stepIndex ? "#6B6760" : "#C0BAB2", fontWeight: i === stepIndex ? 700 : 500 }}>
            {i + 1}. {s.label}
          </span>
        ))}
      </div>

      {error && <div style={{ background: "#FBEAE4", border: "1px solid #F3C4B4", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#8A4A38", marginBottom: 14 }}>{error}</div>}
      {busy && <div style={{ background: "#FDF6EC", border: "1px solid #F5D9A8", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#92400E", marginBottom: 14 }}>{busy}</div>}

      {step === "form" && (
        <div style={card}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginBottom: 18 }}>
            <div>
              <label style={label}>Offer name</label>
              <div style={hint}>e.g. &ldquo;SaaS SEO retainer&rdquo; or &ldquo;Spring workshop&rdquo;.</div>
              <input value={inputs.name} onChange={e => set({ name: e.target.value })} style={input} />
            </div>
            <div>
              <label style={label}>Ideal Client</label>
              <div style={hint}>Who this offer is for — role, company type, size, situation.</div>
              <textarea value={inputs.idealClient} onChange={e => set({ idealClient: e.target.value })} rows={2} style={{ ...input, resize: "vertical" }} />
            </div>
          </div>
          {groupByPillar().map(([pillar, fields]) => (
            <div key={pillar} style={{ borderTop: "1px solid #F5F1EC", paddingTop: 16, marginBottom: 6 }}>
              <div style={sectionLabel}>{pillar}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginBottom: 10 }}>
                {fields.map(f => (
                  <div key={f.key}>
                    <label style={label}>{f.label}</label>
                    <div style={hint}>{f.hint}</div>
                    <textarea value={inputs[f.key]} onChange={e => set({ [f.key]: e.target.value } as Partial<OfferInputs>)} rows={f.rows} style={{ ...input, resize: "vertical" }} />
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", paddingTop: 8 }}>
            <button onClick={runCheck} disabled={!ready || !!busy} style={{ ...primary, opacity: !ready || busy ? 0.5 : 1 }}>Check my offer →</button>
            {!ready && <span style={{ fontSize: 12, color: "#9C9590" }}>Name the offer and describe your Ideal Client to continue. Blank fields are fine — the gap check will flag them.</span>}
          </div>
        </div>
      )}

      {step === "gaps" && check && (
        <div style={{ display: "grid", gap: 16 }}>
          {check.strengths.length > 0 && (
            <div style={card}>
              <div style={sectionLabel}>What&apos;s working</div>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.6, color: "#1A1916" }}>{check.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
          )}
          <div style={card}>
            <div style={sectionLabel}>Gaps</div>
            {check.gaps.length === 0 ? <div style={{ fontSize: 14, color: "#6B6760" }}>No major gaps found.</div> : (
              <div style={{ display: "grid", gap: 10 }}>
                {check.gaps.map((g, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "baseline", fontSize: 14, lineHeight: 1.5 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 8, textTransform: "uppercase", whiteSpace: "nowrap", background: g.severity === "missing" ? "#FBEAE4" : "#FEF3C7", color: g.severity === "missing" ? "#B23A1B" : "#92400E" }}>{g.severity}</span>
                    <span><strong>{fieldLabel(g.field)}:</strong> {g.issue}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={card}>
            <div style={sectionLabel}>Recommended fixes — pick what to integrate</div>
            <div style={{ display: "grid", gap: 10, marginBottom: 18 }}>
              {check.fixes.map(f => (
                <label key={f.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", padding: "10px 12px", border: `1px solid ${chosen.has(f.id) ? "#F3C4B4" : "#ECE7DE"}`, borderRadius: 8, background: chosen.has(f.id) ? "#FFFAF7" : "#fff" }}>
                  <input type="checkbox" checked={chosen.has(f.id)} style={{ marginTop: 3 }}
                    onChange={() => setChosen(prev => { const n = new Set(prev); if (n.has(f.id)) n.delete(f.id); else n.add(f.id); return n })} />
                  <span style={{ fontSize: 14, lineHeight: 1.5 }}><strong>{f.title}</strong> <span style={{ fontSize: 11, color: "#9C9590" }}>· {fieldLabel(f.field)}</span><br /><span style={{ color: "#4A4640" }}>{f.detail}</span></span>
                </label>
              ))}
            </div>
            <label style={label}>Your feedback</label>
            <div style={hint}>Anything to keep, change or avoid — e.g. &ldquo;no money-back guarantees&rdquo;, &ldquo;we can only take 3 clients a quarter&rdquo;.</div>
            <textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows={3} style={{ ...input, resize: "vertical", marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={buildOptions} disabled={!!busy} style={{ ...primary, opacity: busy ? 0.5 : 1 }}>Build 3 options →</button>
              <button onClick={() => setStep("form")} disabled={!!busy} style={ghost}>← Edit offer</button>
            </div>
          </div>
        </div>
      )}

      {step === "options" && options && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14, marginBottom: 16 }}>
            {options.map((o, i) => (
              <div key={i} style={{ ...card, display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#E9532A", textTransform: "uppercase", letterSpacing: "0.05em" }}>Option {i + 1} · {o.label}</div>
                <div style={{ fontSize: 13, color: "#6B6760", margin: "4px 0 12px" }}>{o.angle}</div>
                <div style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 19, fontWeight: 600, lineHeight: 1.3, color: "#1A1916", marginBottom: 12 }}>{o.offer.headline}</div>
                <div style={{ display: "grid", gap: 8, fontSize: 13, lineHeight: 1.5, color: "#1A1916", flex: 1 }}>
                  {OFFER_FIELDS.filter(f => o.offer[f.key]?.trim()).map(f => (
                    <div key={f.key}><span style={{ fontSize: 11, fontWeight: 700, color: "#9C9590" }}>{f.label}</span><div style={{ whiteSpace: "pre-wrap" }}>{o.offer[f.key]}</div></div>
                  ))}
                </div>
                <button onClick={() => { setFinal(o.offer); setStep("final") }} style={{ ...primary, marginTop: 16 }}>Use this one</button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => setStep("gaps")} style={ghost}>← Change fixes or feedback</button>
          </div>
        </div>
      )}

      {step === "final" && final && (
        <div style={card}>
          <div style={sectionLabel}>Final version — edit anything, then save</div>
          <label style={label}>The offer in one sentence</label>
          <textarea value={final.headline} onChange={e => setFinal({ ...final, headline: e.target.value })} rows={2} style={{ ...input, resize: "vertical", marginBottom: 14, fontWeight: 600 }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14, marginBottom: 18 }}>
            {OFFER_FIELDS.map(f => (
              <div key={f.key}>
                <label style={label}>{f.label}</label>
                <textarea value={final[f.key]} onChange={e => setFinal({ ...final, [f.key]: e.target.value })} rows={Math.max(f.rows, 2)} style={{ ...input, resize: "vertical" }} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {canSave
              ? <button onClick={save} disabled={!!busy} style={{ ...primary, opacity: busy ? 0.5 : 1 }}>{offerId ? "Save changes" : "Save offer"}</button>
              : <span style={{ fontSize: 13, color: "#9C9590" }}>Offers save to a client profile — use August as a client to save one.</span>}
            {options && <button onClick={() => setStep("options")} disabled={!!busy} style={ghost}>← Back to options</button>}
            <button onClick={() => { setInputs({ ...inputs, ...stripHeadline(final) }); setCheck(null); setOptions(null); setStep("form") }} disabled={!!busy} style={ghost}>Improve again</button>
            {savedAt && <span style={{ fontSize: 13, color: "#166534" }}>✓ Saved at {savedAt}</span>}
          </div>
        </div>
      )}
    </div>
  )
}

function stripHeadline(v: OfferVersion) {
  const { headline: _headline, ...fields } = v
  return fields
}

function groupByPillar() {
  const groups = new Map<string, (typeof OFFER_FIELDS)[number][]>()
  for (const f of OFFER_FIELDS) groups.set(f.pillar, [...(groups.get(f.pillar) ?? []), f])
  return [...groups.entries()]
}
