"use client"

interface Props {
  label: string
  value: string
  delta: number | null
  sparkline: number[]
  selected: boolean
  onClick: () => void
}

export default function MetricCard({ label, value, delta, sparkline, selected, onClick }: Props) {
  const W = 80
  const H = 28
  const hasData = sparkline.length > 1

  let pts = ""
  if (hasData) {
    const min = Math.min(...sparkline)
    const max = Math.max(...sparkline)
    const range = max - min || 1
    pts = sparkline
      .map((v, i) => {
        const x = (i / (sparkline.length - 1)) * W
        const y = H - ((v - min) / range) * (H - 4) - 2
        return `${x},${y}`
      })
      .join(" ")
  }

  return (
    <button
      onClick={onClick}
      style={{
        flex: "1 1 150px",
        minWidth: 130,
        background: selected ? "#FFF7F4" : "#FFFFFF",
        border: `1.5px solid ${selected ? "#E9532A" : "#ECE7DE"}`,
        borderRadius: 10,
        padding: "14px 16px",
        textAlign: "left",
        cursor: "pointer",
        transition: "border-color 0.12s",
      }}
    >
      <div style={{ fontSize: 11, color: "#9C9590", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 21, fontWeight: 700, color: "#1A1916", fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}>
        {value}
      </div>
      {delta !== null && (
        <div style={{ fontSize: 11, color: delta >= 0 ? "#1F7A4D" : "#C2410C", fontWeight: 600, marginTop: 3 }}>
          {delta >= 0 ? "▲" : "▼"}&nbsp;{Math.abs(Math.round(delta * 10) / 10)}%&nbsp;MoM
        </div>
      )}
      {hasData && (
        <svg width={W} height={H} style={{ marginTop: 8, display: "block", overflow: "visible" }}>
          <polyline
            points={pts}
            fill="none"
            stroke={selected ? "#E9532A" : "#D0C9BF"}
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  )
}
