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

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
