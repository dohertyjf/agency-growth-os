import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { authConfig } from "./auth.config"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      role: "coach" | "client"
      clientId?: string | null
      // Set while the coach is using the app as a client ("switch user").
      impersonator?: { id: string; name: string | null } | null
    }
  }
  interface User {
    role?: "coach" | "client"
    clientId?: string | null
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    // Switch user: the coach can use the app as one of their clients and back.
    // Triggered from the browser via POST /api/auth/session with
    // `data: { switchToUserId }` (see lib/switchUser.ts), so every switch is
    // verified here against the DB and never trusted from the payload.
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.role = (user as { role?: string }).role
        token.clientId = (user as { clientId?: string | null }).clientId
      }
      const switchTo = trigger === "update" ? (session as { switchToUserId?: string } | null)?.switchToUserId : undefined
      if (!switchTo) return token

      if (token.impersonatorId) {
        // Already switched: the only allowed move is back to the coach.
        if (switchTo !== token.impersonatorId) return token
        const coach = await prisma.user.findUnique({ where: { id: switchTo } })
        if (!coach || coach.role !== "coach") return token
        token.id = coach.id
        token.role = coach.role
        token.clientId = coach.clientId
        token.name = coach.name
        token.email = coach.email
        delete token.impersonatorId
        delete token.impersonatorName
        return token
      }

      if (token.role !== "coach") return token
      const target = await prisma.user.findUnique({ where: { id: switchTo }, include: { client: { select: { name: true } } } })
      // Deactivated logins are allowed here on purpose: the coach may want to see
      // what a churned client sees. The layout skips the deactivated bounce while switched.
      if (!target || target.role !== "client") return token
      token.impersonatorId = token.id
      token.impersonatorName = token.name
      token.id = target.id
      token.role = target.role
      token.clientId = target.clientId
      token.name = target.name ?? target.client?.name ?? target.email
      token.email = target.email
      return token
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as "coach" | "client"
        session.user.clientId = token.clientId as string | null
        session.user.impersonator = token.impersonatorId
          ? { id: token.impersonatorId as string, name: (token.impersonatorName as string | null) ?? null }
          : null
      }
      return session
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = (credentials?.email ?? "") as string
        const password = (credentials?.password ?? "") as string
        if (!email || !password) return null

        const user = await prisma.user.findUnique({ where: { email } })
        if (!user?.passwordHash) return null
        // Deactivated login (former client) — keep the profile, deny access.
        if (user.active === false) return null

        const valid = await bcrypt.compare(password, user.passwordHash)
        if (!valid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as "coach" | "client",
          clientId: user.clientId,
        }
      },
    }),
  ],
})
