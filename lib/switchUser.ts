// Browser-side half of "switch user". Posts to next-auth's session endpoint,
// which triggers the JWT callback with `trigger: "update"` and returns the new
// session cookie on the response. Resolves to the resulting session user.
export async function switchSessionTo(userId: string): Promise<{ id?: string } | null> {
  const { csrfToken } = await fetch("/api/auth/csrf").then(r => r.json())
  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ csrfToken, data: { switchToUserId: userId } }),
  })
  if (!res.ok) return null
  const session = await res.json().catch(() => null)
  return session?.user ?? null
}
