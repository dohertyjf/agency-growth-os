import type { Metadata } from "next"
import { Cormorant_Garamond, Hanken_Grotesk } from "next/font/google"
import "./globals.css"

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
})

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-hanken",
})

export const metadata: Metadata = {
  title: "Agency Growth OS",
  description: "Coaching platform for agency owners",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cormorant.variable} ${hanken.variable} h-full`}>
      <body className="min-h-full" style={{ fontFamily: "var(--font-hanken), sans-serif", background: "#FBFAF7", color: "#1A1916" }}>
        {children}
      </body>
    </html>
  )
}
