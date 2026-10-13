// Shared between server and client. Keep this file free of server-only
// imports so the browser bundle can use the types.

export interface PAIntake {
  source: string
  who?: string
  outcome?: string
  price?: string
  worth?: string
  ceiling?: string
}

export type PARank = "Entry" | "Core" | "Premium"

export interface PAPackage {
  rank: PARank
  share: string
  name: string
  tagline: string
  forWho: string
  includes: string[]
  excludes: string[]
  price: string
  term: string
  logic: string
}

export interface PADownsell {
  name: string
  price: string
  what: string
  pitch: string
}

export interface PAAddon {
  name: string
  price: string
  why: string
}

export interface PAResult {
  read: string
  core: string
  flag: string
  packages: [PAPackage, PAPackage, PAPackage]
  present: string
  pushback: string
  downsell: PADownsell
  addons: PAAddon[]
  priceMath: string
  terms: string
}

// Error codes the routes return. The client maps these to plain-English copy
// and never shows the code itself.
export type PAErrorCode =
  | "too_long"
  | "too_short"
  | "bad_request"
  | "rate_limited"
  | "malformed"
  | "unavailable"
  | "error"

export interface PAErrorBody {
  error: PAErrorCode
  retryAfterSeconds?: number
}

// Streamed body: newline-delimited JSON. Heartbeats keep the connection
// warm while Claude works; exactly one terminal line follows.
export type PAStreamLine =
  | { type: "status"; text: string }
  | { type: "result"; data: PAResult }
  | { type: "error"; error: PAErrorCode }
