import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import ImportClient from "./ImportClient"

export default async function ImportClientPage() {
  const session = await auth()
  if (!session) redirect("/auth/signin")
  if (session.user.role !== "coach") redirect("/dashboard")

  return (
    <div>
      <Link href="/clients" style={{ fontSize: 13, color: "#6B6760", textDecoration: "none", display: "inline-block", marginBottom: 16 }}>← Clients</Link>
      <ImportClient />
    </div>
  )
}
