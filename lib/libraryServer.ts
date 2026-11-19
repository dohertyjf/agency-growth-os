import "server-only"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@/app/generated/prisma/client"
import { normalizeTags, CATEGORY_KEYS, sessionSlug } from "@/lib/library"

export const trainingSchema = z.object({
  title: z.string().trim().min(1),
  slug: z.string().trim().nullable().optional(),
  category: z.enum(CATEGORY_KEYS),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  summary: z.string().nullable().optional(),
  outline: z.string().nullable().optional(),
  takeaways: z.string().nullable().optional(),
  actionSteps: z.string().nullable().optional(),
  video: z.string().nullable().optional(),
  worksheet: z.string().nullable().optional(),
  transcript: z.string().nullable().optional(),
  sourceCallId: z.string().nullable().optional(),
  published: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
})

// A free slug for a session, built from the wanted text (or the title):
// "icp-focuser", then "icp-focuser-2" and so on if another session has it.
export async function uniqueSessionSlug(wanted: string, excludeId?: string): Promise<string | null> {
  const base = sessionSlug(wanted)
  if (!base) return null
  for (let n = 1; ; n++) {
    const slug = n === 1 ? base : `${base}-${n}`
    const taken = await prisma.libraryTraining.findFirst({ where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } })
    if (!taken) return slug
  }
}

// Session pages take a slug or, for old links, the id.
export function sessionParamWhere(param: string): Prisma.LibraryTrainingWhereInput {
  return { OR: [{ slug: param }, { id: param }] }
}

// Replace a training's tags with exactly these names, creating any new ones.
export async function setTrainingTags(trainingId: string, names: string[]) {
  const tags = await Promise.all(normalizeTags(names).map(name =>
    prisma.libraryTag.upsert({ where: { name }, create: { name }, update: {} })))
  await prisma.$transaction([
    prisma.libraryTrainingTag.deleteMany({ where: { trainingId } }),
    prisma.libraryTrainingTag.createMany({ data: tags.map(t => ({ trainingId, tagId: t.id })) }),
  ])
}

// Who can see Sessions: coaches always; clients only through a program with
// Sessions access switched on (Programs page), e.g. Breakthrough and Studio.
export async function canSeeSessions(user: { role: string; clientId?: string | null }): Promise<boolean> {
  if (user.role === "coach") return true
  if (!user.clientId) return false
  const m = await prisma.programMembership.findFirst({
    where: { clientId: user.clientId, program: { sessionsAccess: true } },
    select: { programId: true },
  })
  return !!m
}
