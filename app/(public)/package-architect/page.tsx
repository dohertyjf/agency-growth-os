import PackageArchitect from "@/components/PackageArchitect"
import { PA_CONFIG } from "@/lib/packageArchitect/config"

export const metadata = {
  title: "Package Architect — turn what you sell into a package ladder",
  description: "Paste a proposal or describe your work. Get three priced tiers, a paid front end, the add-ons to pull out, and the words to say when someone pushes on price.",
}

// Public, ungated lead tool. The page only passes down non-secret config; the
// prompt and the Claude call live entirely in the API routes.
export default function PackageArchitectPage() {
  return (
    <PackageArchitect
      ctaUrl={PA_CONFIG.ctaUrl}
      minSource={PA_CONFIG.minSourceChars}
      maxTotal={PA_CONFIG.maxInputChars}
    />
  )
}
