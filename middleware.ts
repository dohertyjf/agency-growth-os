import NextAuth from "next-auth"
import { authConfig } from "./auth.config"
import { NextResponse } from "next/server"

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isLoggedIn = !!req.auth

  const isPublic =
    pathname.startsWith("/intake") ||
    pathname.startsWith("/calculator") ||
    pathname.startsWith("/growthreport") ||
    pathname.startsWith("/growthgap") ||
    pathname.startsWith("/lead-goal") ||
    pathname.startsWith("/embed.js") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/intake") ||
    pathname.startsWith("/api/leads") ||
    pathname.startsWith("/api/lead-goal") ||
    pathname.startsWith("/api/auth")

  if (!isPublic && !isLoggedIn) {
    const url = req.nextUrl.clone()
    url.pathname = "/auth/signin"
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
})

// /api/auth is excluded on purpose: the auth wrapper re-sets the session
// cookie on every request it handles. On Netlify that refreshed (stale) cookie
// is appended after the auth route's own Set-Cookie, so a session update such
// as switch-user was silently overridden by the old session.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth).*)"],
}
