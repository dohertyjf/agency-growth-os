import "server-only"
import type { Session } from "next-auth"
import { prisma } from "@/lib/prisma"

// Clients see and edit only their own offers; coaches see everyone's.
export async function findOffer(session: Session, id: string) {
  const offer = await prisma.offer.findUnique({ where: { id } })
  if (!offer) return null
  if (session.user.role === "coach" || offer.clientId === session.user.clientId) return offer
  return null
}
