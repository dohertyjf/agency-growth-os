import "server-only"
import { prisma } from "@/lib/prisma"

// Per-user circuit breaker for AI tools. Not about abuse — at these prices a
// user cannot run up a bill — it exists so a useEffect with a bad dependency
// array cannot fire thousands of requests in a minute.
const PER_MINUTE = 3
const PER_DAY = 20

export async function overRateLimit(userId: string, tool: string): Promise<string | null> {
  const now = Date.now()
  const [lastMinute, lastDay] = await Promise.all([
    prisma.toolRun.count({ where: { userId, tool, createdAt: { gte: new Date(now - 60_000) } } }),
    prisma.toolRun.count({ where: { userId, tool, createdAt: { gte: new Date(now - 86_400_000) } } }),
  ])
  if (lastMinute >= PER_MINUTE) return "Too many requests. Try again in a minute."
  if (lastDay >= PER_DAY) return `You have used all ${PER_DAY} generations for today. Try again tomorrow.`
  // Count the attempt before calling out, so a failing call still burns a slot.
  await prisma.toolRun.create({ data: { userId, tool } })
  return null
}
