"use client"

export default function ConfirmDialog({ open, title, message = "Are you sure? This can't be undone.", confirmLabel = "Yes, Delete", cancelLabel = "No, Nevermind", onConfirm, onCancel }: {
  open: boolean
  title?: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null
  return (
    <div
      onClick={onCancel}
      style={{ position: "fixed", inset: 0, background: "rgba(26,25,22,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 2000 }}
    >
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 14, padding: 24, width: "min(400px, 100%)", boxShadow: "0 12px 48px rgba(0,0,0,0.24)" }}>
        {title && <div style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 20, fontWeight: 600, color: "#1A1916", marginBottom: 6 }}>{title}</div>}
        <div style={{ fontSize: 14, color: "#6B6760", marginBottom: 20 }}>{message}</div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onCancel}
            style={{ padding: "9px 16px", background: "none", border: "1px solid #ECE7DE", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#6B6760" }}>
            {cancelLabel}
          </button>
          <button onClick={onConfirm}
            style={{ padding: "9px 18px", background: "#C2410C", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
