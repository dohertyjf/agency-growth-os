import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { canSeeSessions } from "@/lib/libraryServer"
import type { Prisma } from "@/app/generated/prisma/client"
import { CATEGORIES, lines, categoryLabel } from "@/lib/library"

interface Card {
  id: string
  title: string
  date: string | null
  summary: string | null
  published: boolean
  tags: string[]
  steps: number
  done: number
  category: string
}

const chip = (active: boolean): React.CSSProperties => ({
  fontSize: 12, padding: "4px 11px", borderRadius: 14, textDecoration: "none", whiteSpace: "nowrap",
  border: `1px solid ${active ? "#E9532A" : "#ECE7DE"}`, background: active ? "#FDF1EC" : "#fff", color: active ? "#E9532A" : "#4A4640",
})

function href(params: { q?: string; tag?: string; category?: string }) {
  const sp = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][])
  const s = sp.toString()
  return s ? `/sessions?${s}` : "/sessions"
}

function TrainingCard({ t, showCategory }: { t: Card; showCategory?: boolean }) {
  return (
    <Link href={`/sessions/${t.id}`} style={{ display: "flex", flexDirection: "column", background: "#fff", border: "1px solid #ECE7DE", borderRadius: 10, padding: 16, textDecoration: "none", color: "inherit" }}>
      {showCategory && (
        <div style={{ fontSize: 10, fontWeight: 700, color: "#9C9590", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
          {categoryLabel(t.category)}
        </div>
      )}
      <div style={{ fontSize: 15, fontWeight: 600, color: "#1A1916", lineHeight: 1.35, display: "flex", gap: 8, alignItems: "flex-start" }}>
        <span style={{ flex: 1 }}>{t.title}</span>
        {!t.published && <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 8, background: "#FEF3C7", color: "#92400E", textTransform: "uppercase", letterSpacing: "0.04em", flexShrink: 0 }}>Draft</span>}
      </div>
      {t.summary && <p style={{ fontSize: 13, color: "#6F6B64", margin: "6px 0 0", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{t.summary}</p>}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: "auto", paddingTop: 10, fontSize: 11, color: "#9C9590" }}>
        {t.date && <span>{t.date}</span>}
        {t.tags.map(tag => <span key={tag}>#{tag}</span>)}
        {t.steps > 0 && t.done > 0 && (
          <span style={{ marginLeft: "auto", fontWeight: 600, color: t.done >= t.steps ? "#166534" : "#E9532A" }}>
            {t.done >= t.steps ? "✓ Implemented" : `${t.done}/${t.steps} done`}
          </span>
        )}
      </div>
    </Link>
  )
}

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ q?: string; tag?: string; category?: string }> }) {
  const session = await auth()
  if (!session) redirect("/auth/signin")
  if (!(await canSeeSessions(session.user))) redirect("/dashboard")
  const isCoach = session.user.role === "coach"
  const clientId = session.user.clientId ?? null

  const { q: rawQ, tag, category: rawCategory } = await searchParams
  const q = rawQ?.trim() || undefined
  const category = CATEGORIES.some(c => c.key === rawCategory) ? rawCategory : undefined
  const filtering = !!(q || tag)

  const where: Prisma.LibraryTrainingWhereInput = {
    ...(isCoach ? {} : { publishedAt: { not: null } }),
    ...(category ? { category } : {}),
    ...(tag ? { tags: { some: { tag: { name: tag } } } } : {}),
    ...(q ? {
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { summary: { contains: q, mode: "insensitive" } },
        { outline: { contains: q, mode: "insensitive" } },
        { takeaways: { contains: q, mode: "insensitive" } },
        { actionSteps: { contains: q, mode: "insensitive" } },
        { transcript: { contains: q, mode: "insensitive" } },
        { tags: { some: { tag: { name: { contains: q.toLowerCase() } } } } },
      ],
    } : {}),
  }

  const [trainings, tags, progress] = await Promise.all([
    prisma.libraryTraining.findMany({
      where,
      select: {
        id: true, title: true, date: true, summary: true, actionSteps: true, publishedAt: true,
        category: true,
        tags: { select: { tag: { select: { name: true } } } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    prisma.libraryTag.findMany({
      where: isCoach ? {} : { trainings: { some: { training: { publishedAt: { not: null } } } } },
      orderBy: { name: "asc" },
      select: { name: true },
    }),
    clientId ? prisma.libraryProgress.findMany({ where: { clientId }, select: { trainingId: true, doneSteps: true } }) : [],
  ])

  const doneBy = new Map(progress.map(p => [p.trainingId, p.doneSteps.length]))
  const cards: Card[] = trainings.map(t => {
    const steps = lines(t.actionSteps).length
    return {
      id: t.id, title: t.title, date: t.date, summary: t.summary, published: !!t.publishedAt,
      tags: t.tags.map(x => x.tag.name).sort(), category: t.category,
      steps, done: Math.min(doneBy.get(t.id) ?? 0, steps),
    }
  })

  const shownCategories = CATEGORIES.filter(c => !category || c.key === category)

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 28, fontWeight: 600, margin: "0 0 4px", color: "#1A1916" }}>Studio Sessions</h1>
          <p style={{ fontSize: 13, color: "#9C9590", margin: 0 }}>Past trainings on Pipeline, Offer and Delivery. Watch one, then work through its &ldquo;Implement this&rdquo; steps.</p>
        </div>
        {isCoach && (
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/sessions/tags" style={{ padding: "7px 14px", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 13, color: "#4A4640", textDecoration: "none", background: "#fff" }}>Manage tags</Link>
            <Link href="/sessions/new" style={{ padding: "7px 16px", background: "#E9532A", color: "#fff", borderRadius: 6, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>+ New training</Link>
          </div>
        )}
      </div>

      <form action="/sessions" style={{ display: "flex", gap: 8, marginBottom: 14, maxWidth: 560 }}>
        <input name="q" defaultValue={q ?? ""} placeholder="Search trainings and transcripts…" style={{ flex: 1, padding: "9px 12px", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 14, background: "#fff", minWidth: 0 }} />
        {category && <input type="hidden" name="category" value={category} />}
        {tag && <input type="hidden" name="tag" value={tag} />}
        <button type="submit" style={{ padding: "9px 16px", background: "#1A1916", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Search</button>
      </form>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        <Link href={href({ q, tag })} style={chip(!category)}>All</Link>
        {CATEGORIES.map(c => <Link key={c.key} href={href({ q, tag, category: c.key })} style={chip(category === c.key)}>{c.label}</Link>)}
      </div>
      {tags.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 24 }}>
          {tags.map(t => <Link key={t.name} href={href({ q, category, tag: tag === t.name ? undefined : t.name })} style={chip(tag === t.name)}>#{t.name}</Link>)}
        </div>
      )}

      {filtering ? (
        <div>
          <div style={{ fontSize: 13, color: "#6B6760", marginBottom: 12 }}>
            {cards.length} training{cards.length === 1 ? "" : "s"}
            {q && <> matching &ldquo;{q}&rdquo;</>}
            {tag && <> tagged #{tag}</>}
            {category && <> in {categoryLabel(category)}</>}
            {" · "}<Link href={href({ category })} style={{ color: "#E9532A" }}>Clear</Link>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
            {cards.map(t => <TrainingCard key={t.id} t={t} showCategory />)}
          </div>
        </div>
      ) : (
        shownCategories.map(c => {
          const inCategory = cards.filter(t => t.category === c.key)
          return (
            <section key={c.key} style={{ marginBottom: 36 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, borderBottom: "1px solid #ECE7DE", paddingBottom: 8, marginBottom: 16 }}>
                <h2 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 24, fontWeight: 600, margin: 0, color: "#1A1916" }}>{c.label}</h2>
                <span style={{ fontSize: 13, color: "#9C9590" }}>{c.blurb}</span>
              </div>
              {inCategory.length === 0 ? (
                <div style={{ fontSize: 13, color: "#C0BAB2" }}>Trainings coming soon.</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
                  {inCategory.map(t => <TrainingCard key={t.id} t={t} />)}
                </div>
              )}
            </section>
          )
        })
      )}
    </div>
  )
}
