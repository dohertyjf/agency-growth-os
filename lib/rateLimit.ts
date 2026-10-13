import "server-only"
import { createHash } from "node:crypto"

// In-memory, per-process sliding-window rate limiter keyed by a hashed IP.
//
// Honest about its limits: Netlify runs this app as serverless functions, so
// the map is per instance and empties on cold start. Under load the ceiling
// is approximate. It stops accidental cost, not a determined abuser. The real
// spend guards are the per-call caps (input length, max output tokens).
// If abuse shows up in the logs, swap the store for a table and keep the API.

export interface RateWindow {
  limit: number
  windowMs: number
}

export interface RateResult {
  ok: boolean
  retryAfterSeconds: number
  remaining: number
}

type Store = Map<string, number[]>
const stores = new Map<string, Store>()

function storeFor(bucket: string): Store {
  let s = stores.get(bucket)
  if (!s) { s = new Map(); stores.set(bucket, s) }
  return s
}

// Every ~200 checks, drop keys with no hits inside the longest window so the
// map cannot grow without bound on a warm instance.
let sweepCounter = 0
function maybeSweep(store: Store, maxWindowMs: number, now: number) {
  if (++sweepCounter % 200 !== 0) return
  for (const [k, hits] of store) {
    if (!hits.some(t => now - t < maxWindowMs)) store.delete(k)
  }
}

export function checkRateLimit(bucket: string, key: string, windows: RateWindow[]): RateResult {
  const now = Date.now()
  const store = storeFor(bucket)
  const maxWindow = Math.max(...windows.map(w => w.windowMs))
  maybeSweep(store, maxWindow, now)

  const hits = (store.get(key) ?? []).filter(t => now - t < maxWindow)

  let worstRetry = 0
  let minRemaining = Infinity
  for (const w of windows) {
    const inWindow = hits.filter(t => now - t < w.windowMs)
    const remaining = w.limit - inWindow.length
    minRemaining = Math.min(minRemaining, Math.max(0, remaining))
    if (remaining <= 0) {
      const oldest = Math.min(...inWindow)
      const retry = Math.ceil((oldest + w.windowMs - now) / 1000)
      worstRetry = Math.max(worstRetry, retry)
    }
  }

  if (worstRetry > 0) {
    store.set(key, hits)
    return { ok: false, retryAfterSeconds: worstRetry, remaining: 0 }
  }

  hits.push(now)
  store.set(key, hits)
  return { ok: true, retryAfterSeconds: 0, remaining: minRemaining - 1 }
}

// Netlify sets x-nf-client-connection-ip to the true client address. Fall back
// to the first x-forwarded-for hop, then a sentinel so local dev still works.
export function clientIp(req: Request): string {
  const nf = req.headers.get("x-nf-client-connection-ip")
  if (nf) return nf.trim()
  const xff = req.headers.get("x-forwarded-for")
  if (xff) return xff.split(",")[0].trim()
  const real = req.headers.get("x-real-ip")
  if (real) return real.trim()
  return "unknown"
}

// Salted, truncated SHA-256 of the IP. Good enough to bucket repeat callers
// in logs without writing a raw address anywhere.
export function hashIp(ip: string): string {
  const salt = process.env.RATE_LIMIT_SALT || process.env.AUTH_SECRET || "august"
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 16)
}
