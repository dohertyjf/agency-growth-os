import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { DM_Sans } from "next/font/google"
import ContentFiveTool from "@/components/ContentFiveTool"

const dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-dm" })

export const metadata = { title: "The Content Five — Agency Growth OS" }

// Any logged-in user — coach or client. Generation itself runs server-side
// through /api/tools/content-five, which gates on the same session.
export default async function ContentFivePage() {
  const session = await auth()
  if (!session) redirect("/auth/signin")

  return (
    <div className={dmSans.variable}>
      <Link href="/tools" style={{ fontSize: 13, color: "#6B6760", textDecoration: "none", display: "inline-block", marginBottom: 16 }}>← All tools</Link>
      <ContentFiveTool />
    </div>
  )
}
