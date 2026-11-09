import type { Metadata } from "next"
import localFont from "next/font/local"
import "./globals.css"

// Self-hosted (latin, variable weight) so builds don't depend on fetching from Google Fonts.
const cormorant = localFont({
  src: [
    { path: "./fonts/CormorantGaramond.woff2", weight: "400 700", style: "normal" },
    { path: "./fonts/CormorantGaramond-Italic.woff2", weight: "400 700", style: "italic" },
  ],
  variable: "--font-cormorant",
  display: "swap",
  adjustFontFallback: "Times New Roman",
})

const hanken = localFont({
  src: "./fonts/HankenGrotesk.woff2",
  weight: "400 800",
  variable: "--font-hanken",
  display: "swap",
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
