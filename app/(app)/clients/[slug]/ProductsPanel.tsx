"use client"
import { useState } from "react"
import { fmtCurrency } from "@/lib/calc"

interface Product {
  id: string
  name: string
  description: string | null
  type: "retainer" | "ongoing" | "oneoff"
  monthly: number
}

type ProductForm = { name: string; description: string; type: "retainer" | "ongoing" | "oneoff"; monthly: string }

const defaultForm: ProductForm = { name: "", description: "", type: "retainer", monthly: "" }

const inputStyle: React.CSSProperties = {
  padding: "7px 10px", border: "1px solid #ECE7DE", borderRadius: 6,
  fontSize: 13, background: "#fff", color: "#1A1916",
  width: "100%", boxSizing: "border-box", fontFamily: "inherit", outline: "none",
}
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "#6B6760", display: "block", marginBottom: 4 }

interface Props {
  clientId: string
  initialProducts: Product[]
  onProductsChange?: (products: Product[]) => void
}

export default function ProductsPanel({ clientId, initialProducts, onProductsChange }: Props) {
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<ProductForm>(defaultForm)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<ProductForm>(defaultForm)
  const [editSaving, setEditSaving] = useState(false)

  function update(next: Product[]) {
    setProducts(next)
    onProductsChange?.(next)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch(`/api/clients/${clientId}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        type: form.type,
        monthly: parseFloat(form.monthly),
      }),
    })
    setSaving(false)
    if (!res.ok) return
    const created: Product = await res.json()
    update([...products, created])
    setForm(defaultForm)
    setAdding(false)
  }

  function startEdit(p: Product) {
    setEditingId(p.id)
    setEditForm({ name: p.name, description: p.description ?? "", type: p.type as "retainer" | "ongoing" | "oneoff", monthly: String(p.monthly) })
  }

  async function handleEditSave(e: React.FormEvent, id: string) {
    e.preventDefault()
    setEditSaving(true)
    const res = await fetch(`/api/clients/${clientId}/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editForm.name.trim(),
        description: editForm.description.trim() || null,
        type: editForm.type,
        monthly: parseFloat(editForm.monthly),
      }),
    })
    setEditSaving(false)
    if (!res.ok) return
    const updated: Product = await res.json()
    update(products.map(p => p.id === id ? updated : p))
    setEditingId(null)
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This won't affect existing projects.`)) return
    await fetch(`/api/clients/${clientId}/products/${id}`, { method: "DELETE" })
    update(products.filter(p => p.id !== id))
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#1A1916" }}>Products</div>
          <div style={{ fontSize: 12, color: "#9C9590", marginTop: 2 }}>Reusable templates that pre-fill project details when you create a new project.</div>
        </div>
        <button onClick={() => setAdding(a => !a)}
          style={{ padding: "7px 16px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          + Add Product
        </button>
      </div>

      {adding && (
        <form onSubmit={handleAdd} style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 10, padding: 20, marginBottom: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1916" }}>New Product</div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Name</label>
              <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required autoFocus placeholder="Weekly Coaching" />
            </div>
            <div>
              <label style={labelStyle}>Type</label>
              <select style={inputStyle} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as "retainer" | "ongoing" | "oneoff" }))}>
                <option value="retainer">Retainer (monthly)</option>
                <option value="ongoing">Retainer – Ongoing</option>
                <option value="oneoff">One-off</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>{form.type === "oneoff" ? "Price ($)" : "Monthly Rate ($)"}</label>
              <input style={inputStyle} type="number" value={form.monthly} onChange={e => setForm(f => ({ ...f, monthly: e.target.value }))} required placeholder="3000" min={0} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Description (optional)</label>
            <input style={inputStyle} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. 4 calls/month, unlimited async support" />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" onClick={() => { setAdding(false); setForm(defaultForm) }}
              style={{ padding: "7px 16px", background: "none", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 13, cursor: "pointer", color: "#6B6760" }}>
              Cancel
            </button>
            <button type="submit" disabled={saving}
              style={{ padding: "7px 18px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Saving…" : "Save Product"}
            </button>
          </div>
        </form>
      )}

      {products.length === 0 && !adding ? (
        <div style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: "48px 0", textAlign: "center", color: "#9C9590", fontSize: 13 }}>
          No products yet. Add one to use as a template when creating projects.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {products.map(p => (
            <div key={p.id} style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 10, overflow: "hidden" }}>
              {editingId === p.id ? (
                <form onSubmit={e => handleEditSave(e, p.id)} style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Name</label>
                      <input style={inputStyle} value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} required autoFocus />
                    </div>
                    <div>
                      <label style={labelStyle}>Type</label>
                      <select style={inputStyle} value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value as "retainer" | "ongoing" | "oneoff" }))}>
                        <option value="retainer">Retainer (monthly)</option>
                        <option value="ongoing">Retainer – Ongoing</option>
                        <option value="oneoff">One-off</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>{editForm.type === "oneoff" ? "Price ($)" : "Monthly ($)"}</label>
                      <input style={inputStyle} type="number" value={editForm.monthly} onChange={e => setEditForm(f => ({ ...f, monthly: e.target.value }))} required min={0} />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Description</label>
                    <input style={inputStyle} value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description" />
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button type="button" onClick={() => setEditingId(null)}
                      style={{ padding: "6px 14px", background: "none", border: "1px solid #ECE7DE", borderRadius: 6, fontSize: 12, cursor: "pointer", color: "#6B6760" }}>
                      Cancel
                    </button>
                    <button type="submit" disabled={editSaving}
                      style={{ padding: "6px 16px", background: "#E9532A", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: editSaving ? 0.7 : 1 }}>
                      {editSaving ? "Saving…" : "Save"}
                    </button>
                  </div>
                </form>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 18px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1A1916" }}>{p.name}</div>
                    {p.description && <div style={{ fontSize: 12, color: "#9C9590", marginTop: 2 }}>{p.description}</div>}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: p.type === "oneoff" ? "#F5F3FF" : "#EFF6FF", color: p.type === "oneoff" ? "#6D28D9" : "#1D4ED8", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {p.type === "retainer" ? "Retainer" : p.type === "ongoing" ? "Ongoing" : "One-off"}
                  </span>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#1A1916", fontVariantNumeric: "tabular-nums", minWidth: 90, textAlign: "right" }}>
                    {fmtCurrency(p.monthly)}{p.type !== "oneoff" ? "/mo" : ""}
                  </div>
                  <button onClick={() => startEdit(p)}
                    style={{ background: "none", border: "1px solid #ECE7DE", borderRadius: 5, fontSize: 12, color: "#6B6760", cursor: "pointer", padding: "4px 10px" }}>
                    Edit
                  </button>
                  <button onClick={() => handleDelete(p.id, p.name)}
                    style={{ background: "none", border: "none", color: "#9C9590", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "0 2px" }}>×</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
