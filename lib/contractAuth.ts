import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

/** Coach, or the client user whose profile the project belongs to. Returns the
 *  contract when allowed, null otherwise. */
export async function authorizeContract(contractId: string) {
  const session = await auth()
  if (!session) return null
  const contract = await prisma.contract.findUnique({ where: { id: contractId }, select: { id: true, clientId: true } })
  if (!contract) return null
  if (session.user.role === "coach") return contract
  return session.user.clientId === contract.clientId ? contract : null
}
