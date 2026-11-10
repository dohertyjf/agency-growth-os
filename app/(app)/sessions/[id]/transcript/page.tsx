import { auth } from "@/auth"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { canSeeSessions } from "@/lib/libraryServer"

// The full, unedited transcript of a session, on its own page.
export default async function TranscriptPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect("/auth/signin")
  if (!(await canSeeSessions(session.user))) redirect("/dashboard")
  const isCoach = session.user.role === "coach"
  const { id } = await params

  const training = await prisma.libraryTraining.findFirst({
    where: { id, ...(isCoach ? {} : { publishedAt: { not: null } }) },
    select: { title: true, date: true, transcript: true },
  })
  if (!training || !training.transcript) notFound()

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ fontSize: 13, color: "#9C9590", marginBottom: 8 }}>
        <Link href="/sessions" style={{ color: "#9C9590", textDecoration: "none" }}>Sessions</Link>
        {" / "}<Link href={`/sessions/${id}`} style={{ color: "#9C9590", textDecoration: "none" }}>{training.title}</Link>
      </div>
      <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 28, fontWeight: 600, margin: "0 0 4px", color: "#1A1916" }}>Transcript</h1>
      <div style={{ fontSize: 12, color: "#9C9590", marginBottom: 18 }}>
        {training.title}{training.date ? ` · recorded ${training.date}` : ""}
      </div>
      <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 24, fontSize: 14, color: "#4A4640", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
        {training.transcript}
      </div>
    </div>
  )
}
