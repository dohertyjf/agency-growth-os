import { auth } from "@/auth"
import { redirect } from "next/navigation"
import OfferBuilder from "@/components/offerBuilder/OfferBuilder"

export default async function NewOfferPage() {
  const session = await auth()
  if (!session) redirect("/auth/signin")
  return <OfferBuilder saved={null} canSave={!!session.user.clientId} />
}
