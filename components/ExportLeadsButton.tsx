"use client"

interface Row {
  email: string
  name: string | null
  agency: string | null
  createdAt: string
}

// Downloads a Kit/ConvertKit-ready CSV: Email, First Name, Last Name, Agency, Submitted.
export default function ExportLeadsButton({ rows, filename }: { rows: Row[]; filename: string }) {
  function download() {
    const esc = (s: string) => `"${(s ?? "").replace(/"/g, '""')}"`
    const header = ["Email", "First Name", "Last Name", "Agency", "Submitted"]
    const lines = [header.map(esc).join(",")]
    for (const r of rows) {
      const parts = (r.name ?? "").trim().split(/\s+/).filter(Boolean)
      const first = parts[0] ?? ""
      const last = parts.slice(1).join(" ")
      const date = r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : ""
      lines.push([r.email, first, last, r.agency ?? "", date].map(esc).join(","))
    }
    const csv = lines.join("\r\n")
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <button onClick={download} disabled={rows.length === 0}
      style={{ fontSize: 12, fontWeight: 600, color: rows.length ? "#1A1916" : "#B8B2A8", background: "#fff", border: "1px solid #ECE7DE", borderRadius: 7, padding: "8px 14px", cursor: rows.length ? "pointer" : "default", whiteSpace: "nowrap" }}>
      ⬇ Export CSV
    </button>
  )
}
