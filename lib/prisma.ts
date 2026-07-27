import { PrismaClient } from "@/app/generated/prisma/client"
import { PrismaNeon } from "@prisma/adapter-neon"
import { neonConfig } from "@neondatabase/serverless"

// Route single queries over HTTP fetch instead of opening a WebSocket.
// Removes the ~400ms connection handshake on each serverless invocation —
// the main source of latency on the internal (dynamic) pages.
neonConfig.poolQueryViaFetch = true

function makeClient() {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! })
  return new PrismaClient({ adapter })
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma || makeClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
