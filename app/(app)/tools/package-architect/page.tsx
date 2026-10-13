import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import PackageArchitect from "@/components/PackageArchitect"
import { PA_CONFIG } from "@/lib/packageArchitect/config"

export const metadata = { title: "Package Architect — Agency Growth OS" }

// Same tool as the public /package-architect page, inside the app shell for
// coach and clients. Generation goes through the same public API routes and
// the same per-IP limits; nothing is saved.
export default async function PackageArchitectToolPage() {
  const session = await auth()
  if (!session) redirect("/auth/signin")

  return (
    <div>
      <Link href="/tools" style={{ fontSize: 13, color: "#6B6760", textDecoration: "none", display: "inline-block", marginBottom: 16 }}>← All tools</Link>
      <PackageArchitect
        embedded
        ctaUrl={PA_CONFIG.ctaUrl}
        minSource={PA_CONFIG.minSourceChars}
        maxTotal={PA_CONFIG.maxInputChars}
      />
    </div>
  )
}
