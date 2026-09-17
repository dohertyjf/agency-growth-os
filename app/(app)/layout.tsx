import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import AppNav from "@/components/AppNav"
import ImpersonationBar from "@/components/ImpersonationBar"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/auth/signin")

  // Lock out a client whose login was deactivated, even on an existing session.
  if (session.user.role === "client" && !session.user.impersonator) {
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { active: true } })
    if (user?.active === false) redirect("/auth/signin?deactivated=1")
  }

  return (
    <div style={{ minHeight: "100vh", background: "#FBFAF7" }}>
      {session.user.impersonator && (
        <ImpersonationBar asName={session.user.name ?? session.user.email} coachName={session.user.impersonator.name} />
      )}
      <AppNav role={session.user.role} userName={session.user.name} />
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        {children}
      </main>
    </div>
  )
}
