import { auth } from "@/auth"
import { notFound, redirect } from "next/navigation"
import OfferBuilder from "@/components/offerBuilder/OfferBuilder"
import { findOffer } from "@/lib/offerBuilder/access"
import type { OfferInputs, OfferVersion } from "@/lib/offerBuilder/fields"

export default async function OfferPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect("/auth/signin")
  const { id } = await params
  const offer = await findOffer(session, id)
  if (!offer) notFound()
  // A coach can view any client's offer; only the owning client saves changes.
  const canSave = offer.clientId === session.user.clientId
  return (
    <OfferBuilder
      saved={{ id: offer.id, inputs: offer.inputs as unknown as OfferInputs, current: (offer.current as unknown as OfferVersion | null) ?? null }}
      canSave={canSave}
    />
  )
}
