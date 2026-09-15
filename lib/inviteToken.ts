import { createHash } from "crypto"

// Invite/reset links carry a high-entropy signed JWT. We store only a SHA-256
// hash of it in the database, never the token itself — so a database leak yields
// no usable links (the raw token exists only in the link we hand the coach).
// SHA-256 (not bcrypt) is correct here: the input is already high-entropy, so
// there's nothing to brute-force, and lookups stay a fast exact-match.
export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex")
}
