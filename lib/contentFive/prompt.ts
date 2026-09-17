import "server-only"
import { levelById, shapeFor, FORMATS, CHANNELS, type Answers, type LevelId } from "./options"

// The Content Five prompt. Tested against real inputs — copied verbatim from
// the working prototype. Do not redesign it.
//
// This file is server-only on purpose: the prompt and the per-level briefs are
// the framework, and they must never ship in the client bundle.

const LEVEL_PROMPTS: Record<LevelId, { brief: string; ctaRule: string }> = {
  audience: {
    brief: "Top of funnel. These readers have never heard of this agency. The job is reach and recognition. Each piece has to be useful on its own, to someone who will never hire anyone.",
    ctaRule: "No call to action at all. End on the last beat. Do not ask for a reply, do not mention the agency's services, do not invite anyone to get in touch. The value is the whole piece.",
  },
  nurture: {
    brief: "Middle of funnel. These readers know the agency exists but have not decided about it. The job is trust: depth, proof, process, honest answers, showing the work.",
    ctaRule: "End by pointing to one specific free resource that takes them one step deeper - a guide, checklist, template, teardown, calculator or swipe file. Name the actual resource this piece should lead to. It is a resource, never a sales ask and never a call booking.",
  },
  mine: {
    brief: "Bottom of funnel. These readers already trust the agency and have simply not acted. The job is to make acting easy, specific and obvious right now.",
    ctaRule: "End with one concrete conversion ask - book a call, request an audit, reply with a single word, claim one of a limited number of spots. Say plainly what they get by taking it. One ask only.",
  },
}

export function buildPrompt(v: Answers): string {
  const level = levelById(v.level)
  const { brief, ctaRule } = LEVEL_PROMPTS[v.level]
  const format = FORMATS.find(f => f.id === v.format)?.name ?? v.format
  const channel = CHANNELS.find(c => c.id === v.channel)?.name ?? v.channel
  const shape = shapeFor(v.format, v.channel)

  return `You are planning five pieces of content for an agency owner to publish.

THE AGENCY
What they do: ${v.service}
Who they sell to: ${v.icp}
What that buyer says is wrong, in the buyer's own words: "${v.pain}"
The outcome that buyer would pay for: ${v.outcome}

THE PIECE
Format: ${format}
Channel: ${channel}
Length and shape: ${shape}
Funnel level: ${level.name} (${level.tag})

WHAT THIS LEVEL MEANS
${brief}

THE ASK AT THIS LEVEL
${ctaRule}

TASK
Write five different pieces. Every one must be about a real, specific topic that comes
out of what this agency actually does for this buyer. Not generic marketing advice. Not
advice about running an agency. The reader is the BUYER (${v.icp}), never the agency owner.

The five must be genuinely different topics, not five angles on one topic. Fit the length
and shape above, so a short format gets a tighter idea than a long one.

For each piece give:
- topic: what it is about, 3 to 8 words, a real subject
- title: the working headline, under 14 words
- hook: the opening line or two, written so it can be used as-is
- beats: exactly three short lines, what to cover in order
- cta: follow THE ASK AT THIS LEVEL exactly

NUMBERS
Never invent a figure that asserts a result or a track record. Any number that would be a
claim about what happened - a before and after, an average, a conversion rate, a percentage
lift, a retention figure, a count of clients helped - must be written as the single capital
letter X, so the reader fills it in from their own data.
Right: "cut churn from X months to X months". Wrong: "cut churn from 4.2 months to 9.8 months".
Right: "took pipeline from $X to $X". Wrong: "took pipeline from $80k to $200k".
Numbers that are part of the advice itself stay real and specific: a threshold you recommend,
a cadence, a number of steps, a weekly volume. "Hire an account manager at 12 to 15 active
clients" is advice, not a claim, and stays exactly as it is.

VOICE
Sixth grade reading level. Short sentences. No em dashes, use a spaced hyphen instead.
Never use the construction "it is not X, it is Y". Say each thing once, do not explain the
same point twice in different words. Plain and direct, no hype, no exclamation marks.
Use real metric names and real practices from this buyer's industry. Never leave a square
bracket placeholder anywhere - an unknown number is X and nothing else.

Return JSON only, shaped exactly:
{"ideas":[{"topic":"","title":"","hook":"","beats":["","",""],"cta":""}]}`
}
