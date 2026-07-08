import { auth } from "@/auth"
import { redirect } from "next/navigation"
import AppNav from "@/components/AppNav"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/auth/signin")

  return (
    <div style={{ minHeight: "100vh", background: "#FBFAF7" }}>
      <AppNav role={session.user.role} userName={session.user.name} />
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        {children}
      </main>
    </div>
  )
}
