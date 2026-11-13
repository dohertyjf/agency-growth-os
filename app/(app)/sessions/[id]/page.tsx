import { auth } from "@/auth"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { canSeeSessions } from "@/lib/libraryServer"
import { lines, categoryLabel } from "@/lib/library"
import { videoEmbedUrl } from "@/lib/video"
import ImplementChecklist from "@/components/library/ImplementChecklist"
import PublishButton from "@/components/library/PublishButton"

const resourceLink: React.CSSProperties = {
  display: "block", padding: "10px 14px", border: "1px solid #ECE7DE", borderRadius: 8, fontSize: 13, fontWeight: 600,
  color: "#1A1916", textDecoration: "none", background: "#FBFAF7",
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 10, color: "#9C9590", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>{label}</div>
      {children}
    </div>
  )
}

export default async function TrainingPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect("/auth/signin")
  if (!(await canSeeSessions(session.user))) redirect("/dashboard")
  const isCoach = session.user.role === "coach"
  const clientId = session.user.clientId ?? null
  const { id } = await params

  const training = await prisma.libraryTraining.findFirst({
    where: { id, ...(isCoach ? {} : { publishedAt: { not: null } }) },
    include: {
      tags: { include: { tag: true } },
    },
  })
  if (!training) notFound()

  const progress = clientId
    ? await prisma.libraryProgress.findUnique({ where: { clientId_trainingId: { clientId, trainingId: id } } })
    : null

  const embed = training.video ? videoEmbedUrl(training.video) : null
  const outline = lines(training.outline).map(l => {
    const m = l.match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s*[·•\-–—|]?\s*(.*)$/)
    return m ? { time: m[1], text: m[2] } : { time: null, text: l }
  })
  const takeaways = lines(training.takeaways)
  const steps = lines(training.actionSteps)
  const tags = training.tags.map(t => t.tag.name).sort()

  return (
    <div style={{ maxWidth: 1080 }}>
      <div style={{ fontSize: 13, color: "#9C9590", marginBottom: 8 }}>
        <Link href="/sessions" style={{ color: "#9C9590", textDecoration: "none" }}>Sessions</Link>
        {" / "}<Link href={`/sessions?category=${training.category}`} style={{ color: "#9C9590", textDecoration: "none" }}>{categoryLabel(training.category)}</Link>
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
        <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 32, fontWeight: 600, margin: 0, color: "#1A1916", flex: 1, lineHeight: 1.15 }}>{training.title}</h1>
        {isCoach && (
          <div style={{ display: "flex", gap: 8 }}>
            <Link href={`/sessions/${id}/edit`} style={{ padding: "6px 14px", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 13, color: "#4A4640", textDecoration: "none", background: "#fff" }}>Edit</Link>
            <PublishButton trainingId={id} published={!!training.publishedAt} />
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", fontSize: 12, color: "#9C9590", marginBottom: 22 }}>
        {!training.publishedAt && <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 8, background: "#FEF3C7", color: "#92400E", textTransform: "uppercase", letterSpacing: "0.04em" }}>Draft — only you can see this</span>}
        {training.date && <span>Recorded {training.date}</span>}
        {tags.map(t => <Link key={t} href={`/sessions?tag=${encodeURIComponent(t)}`} style={{ color: "#6B6760", textDecoration: "none" }}>#{t}</Link>)}      </div>

      {embed ? (
        <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, marginBottom: 24, borderRadius: 10, overflow: "hidden", background: "#000" }}>
          <iframe src={embed} title={training.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: 0 }} />
        </div>
      ) : training.video ? (
        <a href={training.video} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginBottom: 24, fontSize: 14, color: "#E9532A", fontWeight: 600 }}>Watch the recording ↗</a>
      ) : null}

      <div className="session-cols">
      <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 24, minWidth: 0 }}>
        {training.summary && (
          <Section label="What you'll learn">
            <p style={{ fontSize: 15, color: "#1A1916", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>{training.summary}</p>
          </Section>
        )}

        {outline.length > 0 && (
          <Section label="What we covered">
            <ol style={{ margin: 0, padding: 0, listStyle: "none", fontSize: 14, color: "#1A1916", lineHeight: 1.5 }}>
              {outline.map((o, i) => (
                <li key={i} style={{ display: "flex", gap: 12, padding: "6px 0", borderTop: i ? "1px solid #F3EFE8" : "none" }}>
                  <span style={{ flexShrink: 0, width: 38, fontSize: 12, color: "#9C9590", fontVariantNumeric: "tabular-nums", paddingTop: 1 }}>{o.time ?? `${i + 1}.`}</span>
                  <span>{o.text}</span>
                </li>
              ))}
            </ol>
          </Section>
        )}

        {takeaways.length > 0 && (
          <Section label="Key takeaways">
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: "#1A1916", lineHeight: 1.6 }}>
              {takeaways.map((t, i) => <li key={i} style={{ marginBottom: 6 }}>{t}</li>)}
            </ul>
          </Section>
        )}

        {steps.length > 0 && (
          <Section label="Implement this">
            <ImplementChecklist trainingId={id} steps={steps} initialDone={progress?.doneSteps ?? []} canTrack={!!clientId && !!training.publishedAt} />
          </Section>
        )}

      </div>

      <aside style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 20, position: "sticky", top: 16, minWidth: 0 }}>
        <div style={{ fontSize: 10, color: "#9C9590", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Resources</div>
        {training.worksheet || training.transcript ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {training.worksheet && (
              <a href={training.worksheet} target="_blank" rel="noopener noreferrer" style={resourceLink}>Worksheet ↗</a>
            )}
            {training.transcript && (/^https?:\/\/\S+$/.test(training.transcript.trim())
              ? <a href={training.transcript.trim()} target="_blank" rel="noopener noreferrer" style={resourceLink}>Raw transcript ↗</a>
              : <Link href={`/sessions/${id}/transcript`} style={resourceLink}>Raw transcript</Link>)}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "#9C9590" }}>No worksheet or transcript for this session yet.</div>
        )}
      </aside>
      </div>
    </div>
  )
}
