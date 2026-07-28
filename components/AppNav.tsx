"use client"
import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"

interface Props {
  role: "coach" | "client"
  userName: string | null | undefined
}

export default function AppNav({ role, userName }: Props) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  const links = [
    { href: "/dashboard", label: "Dashboard" },
    ...(role === "coach" ? [{ href: "/clients", label: "Clients" }] : []),
    { href: "/calls", label: "Calls" },
    ...(role === "coach" ? [{ href: "/prospects", label: "Prospects" }] : []),
    ...(role === "coach" ? [{ href: "/leads", label: "Leads" }] : []),
    ...(role === "coach" ? [{ href: "/leads/lead-goal", label: "Lead Goal" }] : []),
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

  function close() { setMenuOpen(false) }

  return (
    <>
      <style>{`
        @media (max-width: 640px) {
          .appnav-links { display: none !important; }
          .appnav-hamburger { display: flex !important; }
        }
        @media (min-width: 641px) {
          .appnav-hamburger { display: none !important; }
          .appnav-mobile-menu { display: none !important; }
        }
      `}</style>

      <nav style={{ borderBottom: "1px solid #ECE7DE", background: "#fff", position: "relative", zIndex: 40 }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", height: 58, gap: 0 }}>
          {/* Logo */}
          <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", marginRight: 32, flexShrink: 0 }}>
            <div style={{ width: 32, height: 32, background: "#E9532A", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
              JD
            </div>
            <span style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 17, fontWeight: 600, color: "#1A1916", whiteSpace: "nowrap" }}>
              Agency Growth OS
            </span>
          </Link>

          {/* Desktop links */}
          <div className="appnav-links" style={{ display: "flex", gap: 2, flex: 1 }}>
            {links.map(link => (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  padding: "5px 12px", borderRadius: 6, fontSize: 13, fontWeight: 500,
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

          {/* Right-side group: hamburger (mobile) + avatar */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
            {/* Hamburger — hidden on desktop via CSS */}
            <button
              className="appnav-hamburger"
              onClick={() => setMenuOpen(o => !o)}
              style={{
                display: "none", alignItems: "center", justifyContent: "center",
                background: "none", border: "none", cursor: "pointer",
                padding: 6, borderRadius: 6, color: "#1A1916",
              }}
              aria-label="Menu"
            >
              {menuOpen ? (
                <svg width={20} height={20} viewBox="0 0 20 20" fill="none">
                  <line x1={4} y1={4} x2={16} y2={16} stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
                  <line x1={16} y1={4} x2={4} y2={16} stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
                </svg>
              ) : (
                <svg width={20} height={20} viewBox="0 0 20 20" fill="none">
                  <line x1={3} y1={6} x2={17} y2={6} stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
                  <line x1={3} y1={10} x2={17} y2={10} stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
                  <line x1={3} y1={14} x2={17} y2={14} stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
                </svg>
              )}
            </button>

            {/* Avatar / sign out */}
            <button
              onClick={() => signOut({ callbackUrl: "/auth/signin" })}
              title="Sign out"
              style={{ display: "flex", alignItems: "center", background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 8, flexShrink: 0 }}
            >
              <div style={{ width: 30, height: 30, background: "#1A1916", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 700 }}>
                {initials}
              </div>
            </button>
          </div>
        </div>

        {/* Mobile dropdown — hidden on desktop via CSS */}
        {menuOpen && (
          <div
            className="appnav-mobile-menu"
            style={{ borderTop: "1px solid #ECE7DE", background: "#fff", padding: "8px 0 12px" }}
          >
            {links.map(link => (
              <Link
                key={link.href}
                href={link.href}
                onClick={close}
                style={{
                  display: "block", padding: "11px 20px", fontSize: 14, fontWeight: 500,
                  textDecoration: "none",
                  color: isActive(link.href) ? "#E9532A" : "#1A1916",
                  background: isActive(link.href) ? "#FDF1EC" : "transparent",
                }}
              >
                {link.label}
              </Link>
            ))}
            <div style={{ borderTop: "1px solid #F5F1EC", margin: "8px 0 0" }}>
              <button
                onClick={() => signOut({ callbackUrl: "/auth/signin" })}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "11px 20px", fontSize: 14, fontWeight: 500, color: "#9C9590", background: "none", border: "none", cursor: "pointer" }}
              >
                Sign out
              </button>
            </div>
          </div>
        )}
      </nav>
    </>
  )
}
