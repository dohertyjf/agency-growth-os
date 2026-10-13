import type { PAResult } from "@/lib/packageArchitect/types"

// The PDF is the ladder, the starting engagement, the add-on prices and the
// terms. The coaching notes, arithmetic and pushback script stay on the page.
// jsPDF is imported on click so it never lands in the initial bundle.

const LOGO_URL = "/package-architect-logo.jpg"

const INK: [number, number, number] = [26, 25, 22]
const SLATE: [number, number, number] = [107, 103, 96]
const MUTED: [number, number, number] = [156, 149, 144]
const ACCENT: [number, number, number] = [201, 65, 12]
const RULE: [number, number, number] = [236, 231, 222]

async function loadLogo(): Promise<{ dataUrl: string; format: "PNG" | "JPEG"; w: number; h: number } | null> {
  try {
    const res = await fetch(LOGO_URL, { cache: "force-cache" })
    if (!res.ok) return null
    const blob = await res.blob()
    const format = blob.type.includes("jpeg") || blob.type.includes("jpg") ? "JPEG" : "PNG"
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(String(fr.result))
      fr.onerror = reject
      fr.readAsDataURL(blob)
    })
    const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
      img.onerror = reject
      img.src = dataUrl
    })
    return { dataUrl, format, ...dims }
  } catch {
    return null
  }
}

export async function downloadLadderPdf(r: PAResult, preparedFor: string) {
  const { jsPDF } = await import("jspdf")
  const doc = new jsPDF({ unit: "pt", format: "letter" })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 54
  const COL = W - M * 2
  let y = M

  const ensure = (need: number) => {
    if (y + need > H - M) { doc.addPage(); y = M }
  }
  const text = (s: string, size: number, color: [number, number, number], opts: { bold?: boolean; italic?: boolean; gap?: number; width?: number } = {}) => {
    doc.setFont("helvetica", opts.bold ? "bold" : opts.italic ? "italic" : "normal")
    doc.setFontSize(size)
    doc.setTextColor(...color)
    const lines = doc.splitTextToSize(s, opts.width ?? COL) as string[]
    const lh = size * 1.38
    for (const ln of lines) {
      ensure(lh)
      doc.text(ln, M, y)
      y += lh
    }
    y += opts.gap ?? 0
  }
  const rule = (gapAbove = 10, gapBelow = 14) => {
    y += gapAbove
    ensure(2)
    doc.setDrawColor(...RULE)
    doc.setLineWidth(0.75)
    doc.line(M, y, W - M, y)
    y += gapBelow
  }
  const eyebrow = (s: string) => {
    ensure(20)
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...MUTED)
    doc.text(s.toUpperCase(), M, y, { charSpace: 0.8 })
    y += 14
  }

  // Header: logo (optional), title, prepared-for, date
  const logo = await loadLogo()
  if (logo) {
    const lh = 28
    const lw = (logo.w / logo.h) * lh
    doc.addImage(logo.dataUrl, logo.format, M, y - 6, lw, lh)
    y += lh + 10
  }
  text("Package ladder", 24, INK, { bold: true, gap: 2 })
  const who = preparedFor.trim()
  const dateStr = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
  text(who ? `Prepared for ${who}  ·  ${dateStr}` : dateStr, 10, SLATE, { gap: 4 })
  text(r.core, 13, INK, { italic: true })
  rule()

  // The three packages
  for (const p of r.packages) {
    ensure(120)
    eyebrow(`${p.rank}  ·  ${p.share} of buyers`)
    doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(...INK)
    doc.text(p.name, M, y)
    doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(...ACCENT)
    doc.text(p.price, W - M, y, { align: "right" })
    y += 20
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...SLATE)
    doc.text(p.tagline, M, y)
    doc.text(p.term, W - M, y, { align: "right" })
    y += 18
    text(`Right for: ${p.forWho}`, 10, SLATE, { gap: 6 })
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...INK)
    ensure(14); doc.text("Includes", M, y); y += 14
    for (const item of p.includes) text(`•  ${item}`, 10, INK, { width: COL - 12 })
    y += 4
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...MUTED)
    ensure(14); doc.text("Not included", M, y); y += 14
    for (const item of p.excludes) text(`•  ${item}`, 10, MUTED, { width: COL - 12 })
    rule(8, 16)
  }

  // Starting engagement
  ensure(80)
  eyebrow("Where every engagement starts")
  doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(...INK)
  doc.text(r.downsell.name, M, y)
  doc.setTextColor(...ACCENT)
  doc.text(r.downsell.price, W - M, y, { align: "right" })
  y += 18
  text(r.downsell.what, 10, INK, { gap: 4 })
  rule(8, 16)

  // Add-ons
  ensure(60)
  eyebrow("Add-ons")
  for (const a of r.addons) {
    ensure(30)
    doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(...INK)
    doc.text(a.name, M, y)
    doc.setTextColor(...ACCENT)
    doc.text(a.price, W - M, y, { align: "right" })
    y += 14
    text(a.why, 9.5, SLATE, { gap: 6 })
  }
  rule(6, 16)

  // Terms
  eyebrow("Terms")
  text(r.terms, 10, INK, { gap: 10 })

  // Footer on each page
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...MUTED)
    doc.text("Built with John F Doherty's packaging and pricing framework. Prices are a starting point for a conversation, not a valuation.", M, H - 28, { maxWidth: COL - 60 })
    doc.text(`${i} / ${pages}`, W - M, H - 28, { align: "right" })
  }

  // Plain blob download. Works in Chrome, Safari and iOS Safari without any
  // runtime capability; iOS opens it in the viewer with a share sheet.
  const blob = doc.output("blob")
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  const slug = (who || "package-ladder").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  a.href = url
  a.download = `${slug || "package-ladder"}.pdf`
  a.rel = "noopener"
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
