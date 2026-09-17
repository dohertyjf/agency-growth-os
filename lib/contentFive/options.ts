// The Content Five — shared option tables.
//
// Safe to import from the browser: this file holds the labels, the funnel
// levels as the UI shows them, and the format/channel/shape map. The prompt
// text and the per-level briefs live in ./prompt.ts, which is server-only.

export type LevelId = "audience" | "nurture" | "mine"
export type FormatId = "writing" | "video" | "audio" | "images"
export type ChannelId = "google" | "linkedin" | "youtube" | "instagram" | "facebook" | "reddit" | "email" | "podcast"

export interface Level {
  id: LevelId
  name: string
  tag: string
  note: string
  ctaLabel: string
  ctaHuman: string
}

// Exactly three. There is no fourth.
export const LEVELS: Level[] = [
  {
    id: "audience",
    name: "Build Audience",
    tag: "Top of funnel",
    note: "They do not know you exist. 6+ months to leads.",
    ctaLabel: "No ask",
    ctaHuman: "Top of funnel gets no ask. End on the last beat and let it go.",
  },
  {
    id: "nurture",
    name: "Nurture",
    tag: "Middle of funnel",
    note: "They know you, they do not trust you yet. 3-6 months.",
    ctaLabel: "Offer a resource",
    ctaHuman: "Middle of funnel builds trust. Offer a resource or a link that moves them down the know, like, trust ladder. No sales ask.",
  },
  {
    id: "mine",
    name: "Mine",
    tag: "Bottom of funnel",
    note: "They trust you and have not raised a hand. Within 90 days.",
    ctaLabel: "Convert",
    ctaHuman: "Bottom of funnel converts. One specific ask, and say what they get for taking it.",
  },
]

export const FORMATS: { id: FormatId; name: string }[] = [
  { id: "writing", name: "Writing" },
  { id: "video", name: "Video" },
  { id: "audio", name: "Audio" },
  { id: "images", name: "Images" },
]

export const CHANNELS: { id: ChannelId; name: string; fits: FormatId[] }[] = [
  { id: "google", name: "Google", fits: ["writing"] },
  { id: "linkedin", name: "LinkedIn", fits: ["writing", "video", "images"] },
  { id: "youtube", name: "YouTube", fits: ["video", "audio"] },
  { id: "instagram", name: "Instagram", fits: ["video", "images"] },
  { id: "facebook", name: "Facebook", fits: ["writing", "video", "images"] },
  { id: "reddit", name: "Reddit", fits: ["writing"] },
  { id: "email", name: "Email", fits: ["writing"] },
  { id: "podcast", name: "Podcast", fits: ["audio"] },
]

// Length and shape is computed from format + channel, never generated.
// Fall back to the "_" entry when there is no exact match.
const SHAPES: Record<FormatId, Partial<Record<ChannelId, string>> & { _: string }> = {
  writing: {
    google: "1,200-2,000 words, built around one phrase they would search",
    linkedin: "150-250 words, one idea, hook on line one",
    reddit: "A real answer in a thread, no links, 200-400 words",
    email: "250-400 words, one point, one PS",
    facebook: "120-200 words, plain language, no jargon",
    _: "400-600 words, one idea per piece",
  },
  video: {
    youtube: "6-10 minutes, title and thumbnail written first",
    linkedin: "60-90 seconds, captions burned in, face to camera",
    instagram: "30-60 seconds, hook in the first 2 seconds",
    facebook: "60-90 seconds, captions burned in",
    _: "2-4 minutes, one idea, shot in one take",
  },
  audio: {
    podcast: "18-30 minutes, solo or one guest, notes not a script",
    youtube: "20-30 minutes, audio over a static frame",
    _: "10-20 minutes, one idea, recorded in one sitting",
  },
  images: {
    instagram: "6-8 slide carousel, one line per slide",
    linkedin: "5-7 slide PDF carousel, big type",
    facebook: "Single image plus 100 words",
    _: "5-8 slides, one line per slide",
  },
}

export function shapeFor(format: FormatId, channel: ChannelId): string {
  const table = SHAPES[format]
  return table[channel] ?? table._
}

export function levelById(id: LevelId): Level {
  return LEVELS.find(l => l.id === id) ?? LEVELS[0]
}

export interface Answers {
  icp: string
  service: string
  pain: string
  outcome: string
  level: LevelId
  format: FormatId
  channel: ChannelId
}

export interface Idea {
  topic: string
  title: string
  hook: string
  beats: [string, string, string]
  cta: string
}
