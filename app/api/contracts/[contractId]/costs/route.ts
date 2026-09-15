import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { authorizeContract } from "@/lib/contractAuth"

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.enum(["content", "ads", "software", "vendor", "other"]).default("other"),
  reimbursed: z.boolean().default(false),
})

// Add a cost line item ("Blog Posts", "Directory Listings", a vendor) to a project.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const { contractId } = await params
  const contract = await authorizeContract(contractId)
  if (!contract) return Response.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: "Invalid" }, { status: 422 })

  const item = await prisma.projectCostItem.create({ data: { contractId, ...parsed.data } })
  return Response.json(item)
}
