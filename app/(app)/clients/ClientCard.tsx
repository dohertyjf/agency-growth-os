"use client"
import Link from "next/link"
import { fmtCurrency } from "@/lib/calc"
import { useState } from "react"

interface Props {
  id: string
  name: string
  agency: string | null
  status: string
  mrr: number
  latestRevenue: number | null
}

export default function ClientCard({ id, name, agency, status, mrr, latestRevenue }: Props) {
  const [hovered, setHovered] = useState(false)
  return (
    <Link href={`/clients/${id}`} style={{ textDecoration: "none" }}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          background: "#fff",
          border: `1px solid ${hovered ? "#E9532A" : "#ECE7DE"}`,
          borderRadius: 12,
          padding: 20,
          cursor: "pointer",
          boxShadow: hovered ? "0 2px 8px rgba(233,83,42,0.1)" : "none",
          transition: "border-color 0.12s, box-shadow 0.12s",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1A1916", marginBottom: 2 }}>{name}</div>
            {agency && <div style={{ fontSize: 12, color: "#9C9590" }}>{agency}</div>}
          </div>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20,
            background: status === "active" ? "#DCFCE7" : status === "potential" ? "#DBEAFE" : "#FEF9C3",
            color: status === "active" ? "#166534" : status === "potential" ? "#1E40AF" : "#854D0E",
            textTransform: "uppercase", letterSpacing: "0.04em",
          }}>
            {status}
          </span>
        </div>
        <div style={{ display: "flex", gap: 20 }}>
          <div>
            <div style={{ fontSize: 10, color: "#9C9590", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>MRR</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1A1916", fontVariantNumeric: "tabular-nums" }}>{fmtCurrency(mrr)}</div>
          </div>
          {latestRevenue !== null && (
            <div>
              <div style={{ fontSize: 10, color: "#9C9590", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>Revenue</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#1A1916", fontVariantNumeric: "tabular-nums" }}>{fmtCurrency(latestRevenue)}</div>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
