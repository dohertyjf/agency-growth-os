// Offer Builder: the fields an offer is made of. Shared by the form, the
// prompt and saved offers, so the browser and the server agree on the shape.
// The four pillars are John's version of the value equation; scarcity, urgency
// and bonuses come from the Offer Diamond.

export const OFFER_FIELDS = [
  { key: "dreamOutcome", pillar: "Dream Outcome", label: "Dream outcome", hint: "The result your Ideal Client wants most, in their words.", rows: 3 },
  { key: "proof", pillar: "Proof", label: "Proof", hint: "Why they should believe you: results, case studies, testimonials, numbers.", rows: 3 },
  { key: "quickWins", pillar: "Time Delay", label: "Quick wins", hint: "What they get or see in the first days or weeks.", rows: 2 },
  { key: "timeToResult", pillar: "Time Delay", label: "Time to the dream outcome", hint: "How long until they get the main result.", rows: 1 },
  { key: "clientEffort", pillar: "What's Required", label: "What's required from them", hint: "Their time, access, approvals, inputs. Less is better.", rows: 2 },
  { key: "deliverables", pillar: "The Offer", label: "What they get", hint: "The work, deliverables and format (retainer, sprint, audit…).", rows: 3 },
  { key: "price", pillar: "The Offer", label: "Price", hint: "e.g. $8,000/month, 3-month minimum.", rows: 1 },
  { key: "guarantee", pillar: "Risk Reversal", label: "Guarantee", hint: "What happens if it doesn't work. Leave blank if none.", rows: 2 },
  { key: "scarcity", pillar: "Scarcity", label: "Scarcity", hint: "Real limits: spots, capacity, who you'll take on.", rows: 1 },
  { key: "urgency", pillar: "Urgency", label: "Urgency", hint: "Why now: deadlines, price changes, cohort start, cost of waiting.", rows: 1 },
  { key: "bonuses", pillar: "Bonuses", label: "Bonuses", hint: "Extras that add value without adding much delivery work.", rows: 2 },
] as const

export type OfferFieldKey = (typeof OFFER_FIELDS)[number]["key"]
export const OFFER_FIELD_KEYS = OFFER_FIELDS.map(f => f.key) as [OfferFieldKey, ...OfferFieldKey[]]

export type OfferFields = Record<OfferFieldKey, string>

// What the guided form collects.
export interface OfferInputs extends OfferFields {
  name: string
  idealClient: string
}

// One saved/working version of the offer.
export interface OfferVersion extends OfferFields {
  headline: string // the offer in one sentence
}

// Gap check result.
export interface OfferGap { field: OfferFieldKey; severity: "missing" | "weak"; issue: string }
export interface OfferFix { id: string; field: OfferFieldKey; title: string; detail: string }
export interface GapCheck { strengths: string[]; gaps: OfferGap[]; fixes: OfferFix[] }

// One of the three rebuilt options.
export interface OfferOption { label: string; angle: string; offer: OfferVersion }

export function emptyFields(): OfferFields {
  return Object.fromEntries(OFFER_FIELD_KEYS.map(k => [k, ""])) as OfferFields
}

export function fieldLabel(key: string): string {
  return OFFER_FIELDS.find(f => f.key === key)?.label ?? key
}
