"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"

interface Props {
  role: "coach" | "client"
  userName: string | null | undefined
}

export default function AppNav({ role, userName }: Props) {
  const pathname = usePathname()

  const links = [
    { href: "/dashboard", label: "Dashboard" },
    ...(role === "coach" ? [{ href: "/clients", label: "Clients" }] : []),
    { href: "/calls", label: "Calls" },
    ...(role === "coach" ? [{ href: "/prospects", label: "Prospects" }] : []),
    { href: "/insights", label: "Insights" },
  ]

  const initials = (userName ?? "?")
    .split(" ")
    .map((p: string) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard"
    return pathname.startsWith(href)
  }

  return (
    <nav style={{ borderBottom: "1px solid #ECE7DE", background: "#fff" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", height: 58, gap: 0 }}>
        <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", marginRight: 32 }}>
          <div style={{ width: 32, height: 32, background: "#E9532A", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
            JD
          </div>
          <span style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 17, fontWeight: 600, color: "#1A1916", whiteSpace: "nowrap" }}>
            Agency Growth OS
          </span>
        </Link>

        <div style={{ display: "flex", gap: 2, flex: 1 }}>
          {links.map(link => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                padding: "5px 12px",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
                textDecoration: "none",
                color: isActive(link.href) ? "#E9532A" : "#6B6760",
                background: isActive(link.href) ? "#FDF1EC" : "transparent",
                transition: "color 0.1s, background 0.1s",
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <button
          onClick={() => signOut({ callbackUrl: "/auth/signin" })}
          title="Sign out"
          style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 8 }}
        >
          <div style={{ width: 30, height: 30, background: "#1A1916", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
            {initials}
          </div>
        </button>
      </div>
    </nav>
  )
}
