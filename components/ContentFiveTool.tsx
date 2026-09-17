"use client"
import { useMemo, useState } from "react"
import {
  LEVELS, FORMATS, CHANNELS, shapeFor, levelById,
  type Answers, type Idea, type LevelId, type FormatId, type ChannelId,
} from "@/lib/contentFive/options"

// ---------------------------------------------------------------------------
// Worked example — the page opens with these showing, not an empty form.
// ---------------------------------------------------------------------------

const EXAMPLE_ANSWERS: Answers = {
  icp: "podiatrists who own their practice",
  service: "Google Ads and local SEO",
  pain: "We get calls, but half of them are for things we do not even treat, and the new patients we do want are going to the clinic down the road.",
  outcome: "a steady flow of new patients for the conditions they actually want to treat",
  level: "nurture",
  format: "writing",
  channel: "google",
}

const EXAMPLE_IDEAS: Idea[] = [
  {
    topic: "Google Business Profile for podiatry",
    title: "Why Your Podiatry Practice Ranks Below the Clinic Down the Street",
    hook: "Two podiatry offices sit one mile apart. One shows up in the map pack every time. The other one does not.",
    beats: [
      "What the map pack looks at: reviews, categories, and photos",
      "The three profile fields most practices leave blank",
      "How to check your own profile in five minutes",
    ],
    cta: "Download the Google Business Profile checklist for podiatry practices. It walks through every field, in order.",
  },
  {
    topic: "Cost per new patient from Google Ads",
    title: "What a New Patient Should Cost You on Google Ads",
    hook: "Most practice owners know their ad spend. Few know what one new patient costs them. That number decides everything.",
    beats: [
      "How to work out cost per new patient from your ad account and your front desk log",
      "Why heel pain and ingrown toenail searches cost different amounts",
      "The number that tells you whether to spend more or stop",
    ],
    cta: "Use the free new patient cost calculator. Put in your spend and your bookings and it does the math for you.",
  },
  {
    topic: "Wasted ad spend on the wrong searches",
    title: "The Searches You Are Paying For That Never Book",
    hook: "Someone searches \"podiatrist salary\" and clicks your ad. You paid for that click. They were never going to book.",
    beats: [
      "Where to find the search terms report in your account",
      "The 12 words podiatry practices should block first",
      "How often to check it so the waste does not build up again",
    ],
    cta: "Grab the negative keyword list for podiatry practices. Copy it into your account today.",
  },
  {
    topic: "Reviews that name the condition treated",
    title: "The One Thing Your Patient Reviews Are Missing",
    hook: "A review that says \"great doctor\" helps a little. A review that says \"fixed my plantar fasciitis in X visits\" helps a lot.",
    beats: [
      "Why Google reads the words inside a review, not just the stars",
      "How to ask a patient so they name the condition",
      "A simple two-step follow up after the visit",
    ],
    cta: "Get the review request script for podiatry offices. Two texts and one email, ready to send.",
  },
  {
    topic: "Service pages for each condition",
    title: "One Page Per Condition Beats One Page for Everything",
    hook: "Your website has a Services page. It lists 14 conditions. Google does not know which one you want to rank for.",
    beats: [
      "Why a plantar fasciitis page ranks and a services list does not",
      "What goes on a condition page: symptoms, treatment, what to expect",
      "Which five conditions to build pages for first",
    ],
    cta: "Download the condition page template. It has the sections in order and a word count for each.",
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// A standalone capital X is a number only the reader can fill in.
const X_RE = /(?<![A-Za-z0-9])(X)(?![A-Za-z0-9])/

function Hi({ text }: { text: string }) {
  const parts = text.split(X_RE)
  if (parts.length === 1) return <>{text}</>
  return (
    <>
      {parts.map((p, i) => (p === "X" && i % 2 === 1 ? <mark key={i} className="cf-x">X</mark> : <span key={i}>{p}</span>))}
    </>
  )
}

function askFor(level: LevelId, cta: string): string {
  // Belt and braces: top of funnel never shows an ask, whatever came back.
  if (level === "audience") return "No ask. End on the last beat."
  return cta
}

function answersKey(a: Answers) {
  return JSON.stringify(a)
}

function plainText(ideas: Idea[], answers: Answers, first: number | null): string {
  const level = levelById(answers.level)
  const format = FORMATS.find(f => f.id === answers.format)?.name
  const channel = CHANNELS.find(c => c.id === answers.channel)?.name
  const lines: string[] = [
    `The Content Five - ${level.name} (${level.tag}) - ${format} on ${channel}`,
    `Length and shape: ${shapeFor(answers.format, answers.channel)}`,
    level.ctaHuman,
    "Every X is a number only you can fill in.",
    "",
  ]
  ideas.forEach((idea, i) => {
    lines.push(`${i + 1}. ${idea.title}${first === i ? "  (Do this first)" : ""}`)
    lines.push(`Topic: ${idea.topic}`)
    lines.push(`Hook: "${idea.hook}"`)
    idea.beats.forEach((b, j) => lines.push(`  ${j + 1}) ${b}`))
    lines.push(`${level.ctaLabel}: ${askFor(answers.level, idea.cta)}`)
    lines.push("")
  })
  return lines.join("\n")
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ContentFiveTool() {
  const [answers, setAnswers] = useState<Answers>(EXAMPLE_ANSWERS)
  const [ideas, setIdeas] = useState<Idea[]>(EXAMPLE_IDEAS)
  // The answers that produced the ideas currently on screen.
  const [resultAnswers, setResultAnswers] = useState<Answers>(EXAMPLE_ANSWERS)
  const [first, setFirst] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const set = <K extends keyof Answers>(key: K, value: Answers[K]) =>
    setAnswers(a => ({ ...a, [key]: value }))

  function pickFormat(format: FormatId) {
    setAnswers(a => {
      const channel = CHANNELS.find(c => c.id === a.channel)
      // Selecting a format that invalidates the current channel clears it.
      const keep = channel?.fits.includes(format)
      return { ...a, format, channel: keep ? a.channel : ("" as ChannelId) }
    })
  }

  const complete =
    answers.icp.trim() && answers.service.trim() && answers.pain.trim() &&
    answers.outcome.trim() && answers.level && answers.format && answers.channel
  const unchanged = answersKey(answers) === answersKey(resultAnswers)

  const fittingChannels = useMemo(
    () => CHANNELS.filter(c => !answers.format || c.fits.includes(answers.format)).map(c => c.name),
    [answers.format],
  )

  async function generate() {
    if (!complete || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/tools/content-five", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(answers),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error ?? "Something went wrong. Try again.")
        return
      }
      setIdeas(data.ideas)
      setResultAnswers(answers)
      setFirst(null)
    } catch {
      setError("Could not reach the server. Try again.")
    } finally {
      setLoading(false)
    }
  }

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(plainText(ideas, resultAnswers, first))
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setError("Could not copy. Select the text and copy it by hand.")
    }
  }

  const resultLevel = levelById(resultAnswers.level)
  const resultShape = shapeFor(resultAnswers.format, resultAnswers.channel)
  const resultFormat = FORMATS.find(f => f.id === resultAnswers.format)?.name
  const resultChannel = CHANNELS.find(c => c.id === resultAnswers.channel)?.name

  return (
    <div className="cf-root">
      <style>{CSS}</style>

      <header className="cf-head">
        <div className="cf-eyebrow">A tool from August</div>
        <h1 className="cf-title">The Content Five</h1>
        <p className="cf-sub">
          Answer seven questions about one of your clients. Get back five specific pieces of content you could make for them this month.
          Every piece is written to <em>their</em> customer, not to you.
        </p>
      </header>

      <div className="cf-grid">
        {/* ---------------- Form ---------------- */}
        <form className="cf-form" onSubmit={e => { e.preventDefault(); generate() }}>
          <Q n="01" label="My client is…" hint="Specific enough that they would recognise themselves.">
            <input className="cf-input" value={answers.icp} onChange={e => set("icp", e.target.value)} placeholder="podiatrists who own their practice" />
          </Q>

          <Q n="02" label="What I do for them…" hint="Your actual service. This is where the topics come from.">
            <input className="cf-input" value={answers.service} onChange={e => set("service", e.target.value)} placeholder="Google Ads and local SEO" />
          </Q>

          <Q n="03" label="What they would say is wrong…" hint="Their words, not yours.">
            <textarea className="cf-input cf-textarea" rows={3} value={answers.pain} onChange={e => set("pain", e.target.value)} placeholder="We get calls, but half are for things we do not treat." />
          </Q>

          <Q n="04" label="The outcome they would pay for…">
            <input className="cf-input" value={answers.outcome} onChange={e => set("outcome", e.target.value)} placeholder="a steady flow of the right new patients" />
          </Q>

          <Q n="05" label="I need ideas at this part of the funnel" hint="The right part depends on how fast you need leads. It also decides the ask.">
            <div className="cf-levels">
              {LEVELS.map(l => (
                <button
                  key={l.id} type="button"
                  className={`cf-level${answers.level === l.id ? " is-on" : ""}`}
                  onClick={() => set("level", l.id)}
                  aria-pressed={answers.level === l.id}
                >
                  <span className="cf-level-name">{l.name}</span>
                  <span className="cf-level-tag">{l.tag}</span>
                  <span className="cf-level-note">{l.note}</span>
                </button>
              ))}
            </div>
          </Q>

          <Q n="06" label="I am already good at…" hint="What you are good at and actually enjoy. Not what you think would work.">
            <div className="cf-pills">
              {FORMATS.map(f => (
                <button
                  key={f.id} type="button"
                  className={`cf-pill${answers.format === f.id ? " is-on" : ""}`}
                  onClick={() => pickFormat(f.id)}
                  aria-pressed={answers.format === f.id}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </Q>

          <Q n="07" label="So I am picking this channel">
            <div className="cf-pills">
              {CHANNELS.map(c => {
                const fits = !answers.format || c.fits.includes(answers.format)
                return (
                  <button
                    key={c.id} type="button"
                    className={`cf-pill${answers.channel === c.id ? " is-on" : ""}${fits ? "" : " is-dim"}`}
                    onClick={() => set("channel", c.id)}
                    aria-pressed={answers.channel === c.id}
                  >
                    {c.name}
                  </button>
                )
              })}
            </div>
            <p className="cf-teach">
              {answers.format
                ? <>Pick {FORMATS.find(f => f.id === answers.format)?.name.toLowerCase()} and your real options are {fittingChannels.join(", ")}. The dimmed ones mean learning a new format first.</>
                : <>Pick a format above and the channels that fit it stay bright. The dimmed ones mean learning a new format first.</>}
            </p>
            {answers.format && answers.channel && (
              <p className="cf-shape-line">
                Length and shape: <strong>{shapeFor(answers.format, answers.channel)}</strong>
              </p>
            )}
          </Q>

          <div className="cf-submit">
            <button type="submit" className="cf-btn cf-btn-primary" disabled={!complete || loading}>
              {loading ? "Writing five…" : unchanged ? "Five different ones" : "Give me five"}
            </button>
            <span className="cf-submit-note">{loading ? "This takes 5 to 20 seconds." : "Nothing is saved."}</span>
          </div>
          {error && (
            <div className="cf-error" role="alert">
              {error}{" "}
              <button type="button" className="cf-link" onClick={generate} disabled={loading}>Try again</button>
            </div>
          )}
        </form>

        {/* ---------------- Results ---------------- */}
        <section className={`cf-results${loading ? " is-loading" : ""}`} aria-busy={loading}>
          <div className="cf-results-head">
            <div className="cf-eyebrow">
              Five for {resultAnswers.icp} · {resultFormat} on {resultChannel}
            </div>
            <h2 className="cf-h2">{resultLevel.name} <span className="cf-h2-tag">{resultLevel.tag}</span></h2>
            <p className="cf-cta-human">{resultLevel.ctaHuman}</p>
            <p className="cf-x-note">Every <mark className="cf-x">X</mark> is a number only you can fill in.</p>
          </div>

          <ol className="cf-cards">
            {ideas.map((idea, i) => (
              <li key={i} className={`cf-card${first === i ? " is-first" : ""}`}>
                <div className="cf-card-top">
                  <span className="cf-num">0{i + 1}</span>
                  <span className="cf-topic"><Hi text={idea.topic} /></span>
                  <button
                    type="button"
                    className={`cf-first-btn${first === i ? " is-on" : ""}`}
                    onClick={() => setFirst(first === i ? null : i)}
                    aria-pressed={first === i}
                  >
                    {first === i ? "Doing this first" : "Do this first"}
                  </button>
                </div>
                <h3 className="cf-card-title"><Hi text={idea.title} /></h3>
                <blockquote className="cf-hook"><Hi text={idea.hook} /></blockquote>
                <ol className="cf-beats">
                  {idea.beats.map((b, j) => <li key={j}><Hi text={b} /></li>)}
                </ol>
                <div className="cf-ask">
                  <span className="cf-ask-label">{resultLevel.ctaLabel}</span>
                  <span className="cf-ask-text"><Hi text={askFor(resultAnswers.level, idea.cta)} /></span>
                </div>
                <div className="cf-chip">{resultShape}</div>
              </li>
            ))}
          </ol>

          <div className="cf-actions">
            <button type="button" className="cf-btn cf-btn-primary" onClick={generate} disabled={!complete || loading}>
              {loading ? "Writing five…" : "Five different ones"}
            </button>
            <button type="button" className="cf-btn" onClick={copyAll}>{copied ? "Copied" : "Copy all five"}</button>
            <button type="button" className="cf-btn" onClick={() => window.print()}>Print</button>
          </div>
        </section>
      </div>
    </div>
  )
}

function Q({ n, label, hint, children }: { n: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="cf-q">
      <div className="cf-q-head">
        <span className="cf-q-num">{n}</span>
        <span className="cf-q-label">{label}</span>
      </div>
      {children}
      {hint && <p className="cf-hint">{hint}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Styles — cream / orange / near-black, Cormorant display, DM Sans body.
// Light by default; dark follows the OS preference.
// ---------------------------------------------------------------------------

const CSS = `
.cf-root {
  --cf-bg: #EDE7DE;
  --cf-card: #F7F3EC;
  --cf-ink: #16130F;
  --cf-muted: #6B6459;
  --cf-line: rgba(22, 19, 15, 0.14);
  --cf-accent: #FF5317;
  --cf-accent-soft: rgba(255, 83, 23, 0.10);
  --cf-x: rgba(255, 83, 23, 0.18);
  --cf-display: var(--font-cormorant), "Cormorant Garamond", Georgia, serif;
  --cf-body: var(--font-dm), "DM Sans", system-ui, sans-serif;
  font-family: var(--cf-body);
  color: var(--cf-ink);
  background: var(--cf-bg);
  border-radius: 16px;
  padding: 36px clamp(16px, 4vw, 44px) 44px;
  margin: 0 -8px;
  line-height: 1.5;
}
@media (prefers-color-scheme: dark) {
  .cf-root {
    --cf-bg: #16130F;
    --cf-card: #211D17;
    --cf-ink: #EDE7DE;
    --cf-muted: #A59D91;
    --cf-line: rgba(237, 231, 222, 0.16);
    --cf-accent-soft: rgba(255, 83, 23, 0.16);
    --cf-x: rgba(255, 83, 23, 0.30);
  }
}
.cf-root * { box-sizing: border-box; }
.cf-root button { font-family: inherit; cursor: pointer; }
.cf-root button:disabled { cursor: default; }

.cf-eyebrow { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--cf-accent); font-weight: 600; }
.cf-head { max-width: 640px; margin-bottom: 36px; }
.cf-title { font-family: var(--cf-display); font-size: clamp(40px, 6vw, 60px); font-weight: 500; line-height: 1; margin: 8px 0 14px; letter-spacing: -0.01em; }
.cf-sub { font-size: 15px; color: var(--cf-muted); margin: 0; }
.cf-sub em { color: var(--cf-ink); font-style: italic; }

.cf-grid { display: grid; grid-template-columns: minmax(300px, 400px) minmax(0, 1fr); gap: 48px; align-items: start; }
@media (max-width: 920px) { .cf-grid { grid-template-columns: 1fr; gap: 36px; } }

/* Form: fill-in-the-blank statements */
.cf-q { margin-bottom: 30px; }
.cf-q-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 8px; }
.cf-q-num { font-size: 11px; font-weight: 600; letter-spacing: 0.1em; color: var(--cf-accent); }
.cf-q-label { font-family: var(--cf-display); font-size: 24px; font-weight: 500; line-height: 1.15; }
.cf-hint { font-size: 12.5px; color: var(--cf-muted); margin: 8px 0 0; }
.cf-input {
  width: 100%; font: inherit; font-size: 16px; color: var(--cf-ink);
  background: transparent; border: 0; border-bottom: 1.5px solid var(--cf-line);
  padding: 8px 0; border-radius: 0; transition: border-color .15s;
}
.cf-input::placeholder { color: var(--cf-muted); opacity: .6; }
.cf-root .cf-input:focus { outline: none; border-color: var(--cf-accent) !important; box-shadow: none; }
.cf-textarea { resize: vertical; min-height: 72px; line-height: 1.45; }

.cf-levels { display: grid; gap: 8px; }
.cf-level {
  display: grid; grid-template-columns: 1fr auto; gap: 2px 12px; text-align: left;
  background: var(--cf-card); border: 1.5px solid var(--cf-line); border-radius: 10px;
  padding: 12px 14px; color: var(--cf-ink); transition: border-color .15s, background .15s;
}
.cf-level:hover { border-color: var(--cf-accent); }
.cf-level.is-on { border-color: var(--cf-accent); background: var(--cf-accent-soft); }
.cf-level-name { font-family: var(--cf-display); font-size: 21px; font-weight: 600; line-height: 1.1; }
.cf-level-tag { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--cf-muted); align-self: center; }
.cf-level.is-on .cf-level-tag { color: var(--cf-accent); }
.cf-level-note { grid-column: 1 / -1; font-size: 12.5px; color: var(--cf-muted); }

.cf-pills { display: flex; flex-wrap: wrap; gap: 8px; }
.cf-pill {
  font-size: 14px; font-weight: 500; padding: 7px 14px; border-radius: 999px;
  background: var(--cf-card); border: 1.5px solid var(--cf-line); color: var(--cf-ink);
  transition: opacity .15s, border-color .15s, background .15s;
}
.cf-pill:hover { border-color: var(--cf-accent); }
.cf-pill.is-on { background: var(--cf-ink); border-color: var(--cf-ink); color: var(--cf-bg); }
.cf-pill.is-dim { opacity: 0.42; }
.cf-pill.is-dim.is-on { opacity: 1; }
.cf-teach { font-size: 12.5px; color: var(--cf-muted); margin: 12px 0 0; }
.cf-shape-line { font-size: 13px; margin: 8px 0 0; color: var(--cf-muted); }
.cf-shape-line strong { color: var(--cf-ink); font-weight: 500; }

.cf-submit { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-top: 6px; }
.cf-submit-note { font-size: 12.5px; color: var(--cf-muted); }
.cf-btn {
  font-size: 14px; font-weight: 600; padding: 11px 20px; border-radius: 999px;
  background: transparent; border: 1.5px solid var(--cf-ink); color: var(--cf-ink);
  transition: background .15s, color .15s, opacity .15s;
}
.cf-btn:hover:not(:disabled) { background: var(--cf-ink); color: var(--cf-bg); }
.cf-btn-primary { background: var(--cf-accent); border-color: var(--cf-accent); color: #fff; }
.cf-btn-primary:hover:not(:disabled) { background: var(--cf-ink); border-color: var(--cf-ink); color: var(--cf-bg); }
.cf-btn:disabled { opacity: .5; }
.cf-error { margin-top: 14px; font-size: 13.5px; color: var(--cf-accent); }
.cf-link { background: none; border: 0; padding: 0; color: inherit; font: inherit; text-decoration: underline; }

/* Results */
.cf-results { min-width: 0; transition: opacity .2s; }
.cf-results.is-loading { opacity: .45; pointer-events: none; }
.cf-results-head { margin-bottom: 22px; }
.cf-h2 { font-family: var(--cf-display); font-size: 36px; font-weight: 500; margin: 6px 0 8px; line-height: 1.05; display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.cf-h2-tag { font-family: var(--cf-body); font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--cf-muted); font-weight: 600; }
.cf-cta-human { font-size: 15px; margin: 0 0 6px; max-width: 620px; }
.cf-x-note { font-size: 13px; color: var(--cf-muted); margin: 0; }
.cf-x { background: var(--cf-x); color: var(--cf-accent); font-weight: 700; padding: 0 3px; border-radius: 3px; }

.cf-cards { list-style: none; margin: 0; padding: 0; display: grid; gap: 14px; }
.cf-card {
  background: var(--cf-card); border: 1.5px solid var(--cf-line); border-radius: 14px;
  padding: 22px 24px 20px; position: relative; transition: border-color .15s;
}
.cf-card.is-first { border-color: var(--cf-accent); box-shadow: 0 0 0 3px var(--cf-accent-soft); }
.cf-card-top { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
.cf-num { font-family: var(--cf-display); font-size: 22px; font-weight: 600; color: var(--cf-accent); line-height: 1; }
.cf-topic { font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--cf-muted); font-weight: 600; flex: 1; min-width: 0; }
.cf-first-btn {
  font-size: 12px; font-weight: 600; padding: 5px 11px; border-radius: 999px;
  background: transparent; border: 1.5px solid var(--cf-line); color: var(--cf-muted); white-space: nowrap;
  transition: border-color .15s, color .15s, background .15s;
}
.cf-first-btn:hover { border-color: var(--cf-accent); color: var(--cf-accent); }
.cf-first-btn.is-on { background: var(--cf-accent); border-color: var(--cf-accent); color: #fff; }
.cf-card-title { font-family: var(--cf-display); font-size: 28px; font-weight: 600; line-height: 1.12; margin: 0 0 14px; letter-spacing: -0.005em; }
.cf-hook {
  margin: 0 0 16px; padding: 4px 0 4px 16px; border-left: 3px solid var(--cf-accent);
  font-family: var(--cf-display); font-style: italic; font-size: 20px; line-height: 1.3;
}
.cf-hook::before { content: "\\201C"; color: var(--cf-accent); margin-right: 2px; }
.cf-hook::after { content: "\\201D"; color: var(--cf-accent); margin-left: 2px; }
.cf-beats { list-style: decimal; margin: 0 0 16px; padding-left: 22px; font-size: 15px; display: grid; gap: 4px; }
.cf-beats li::marker { color: var(--cf-accent); font-weight: 600; }
.cf-ask { display: grid; grid-template-columns: auto 1fr; gap: 12px; align-items: baseline; padding-top: 14px; border-top: 1px solid var(--cf-line); font-size: 14.5px; }
.cf-ask-label { font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--cf-accent); font-weight: 700; white-space: nowrap; }
.cf-chip { display: inline-block; margin-top: 14px; font-size: 12px; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--cf-line); color: var(--cf-muted); }

.cf-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 22px; }

@media (max-width: 560px) {
  .cf-card { padding: 18px 16px 16px; }
  .cf-card-title { font-size: 24px; }
  .cf-hook { font-size: 18px; }
  .cf-ask { grid-template-columns: 1fr; gap: 4px; }
}

@media print {
  nav, .cf-form, .cf-actions, .cf-first-btn { display: none !important; }
  .cf-root { background: #fff; color: #000; padding: 0; margin: 0; border-radius: 0; --cf-card: #fff; --cf-line: #ccc; --cf-muted: #444; }
  .cf-grid { display: block; }
  .cf-card { break-inside: avoid; box-shadow: none; }
  .cf-card.is-first { border-color: #000; }
  .cf-card.is-first .cf-topic::after { content: "  ·  Do this first"; color: #000; }
}
`
