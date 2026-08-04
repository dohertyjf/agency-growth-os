"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import * as XLSX from "xlsx"

const accent = "#E9532A"

type Grid = (string | number | Date)[][]

interface AccountRow { accountName: string; projectName: string; type: string; monthly: number; status: string; start: string; contractedThrough: string | null }
interface MetricRow { month: string; revenue: number; totalExpenses: number; salaries: number; software: number; cashInBank: number; leads: number; newClients: number; churn: number; marketingSpend: number }
interface TeamRow { name: string; role?: string; annualSalary: number; billableHours: number; isExternal: boolean }

interface Parsed {
  client: { name: string; agency: string; email: string; currency: string }
  accounts: AccountRow[]
  metrics: MetricRow[]
  team: TeamRow[]
  skipped: string[]
}

// ── helpers ──────────────────────────────────────────────────────────────────
const str = (v: unknown) => (v == null ? "" : String(v).trim())
function num(v: unknown): number {
  if (typeof v === "number") return v
  const n = parseFloat(String(v ?? "").replace(/[$£€,\s%]/g, ""))
  return isNaN(n) ? 0 : n
}
function ym(v: unknown): string {
  if (v instanceof Date) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}`
  const s = str(v)
  if (/^\d{4}-\d{2}$/.test(s)) return s
  const m = s.match(/^(\d{1,2})\/(\d{4})$/)
  if (m) return `${m[2]}-${m[1].padStart(2, "0")}`
  return ""
}
function normType(v: unknown): string {
  const s = str(v).toLowerCase()
  if (["oneoff", "one-off", "one off", "o"].includes(s)) return "oneoff"
  if (["ongoing", "retainer-ongoing", "retainer ongoing"].includes(s)) return "ongoing"
  return "retainer"
}
function normStatus(v: unknown): string {
  const s = str(v).toLowerCase()
  if (["potential", "p"].includes(s)) return "potential"
  if (["finished", "f", "done", "ended"].includes(s)) return "finished"
  return "active"
}
function dataRows(grid: Grid, firstHeader: string): Grid {
  const hi = grid.findIndex(r => str(r[0]).toLowerCase() === firstHeader.toLowerCase())
  if (hi < 0) return []
  return grid.slice(hi + 1).filter(r => str(r[0]) !== "")
}
function findValue(grid: Grid, label: string): string {
  const row = grid.find(r => str(r[0]).toLowerCase() === label.toLowerCase())
  return row ? str(row[1]) : ""
}

const EXAMPLES: Record<string, string[]> = {
  accounts: ["acme marketing", "seo retainer"],
  metrics: ["2026-01"],
  team: ["jane smith", "consultant"],
}

export default function ImportClient({ clients = [] }: { clients?: { id: string; name: string; slug: string | null }[] }) {
  const router = useRouter()
  const [parsed, setParsed] = useState<Parsed | null>(null)
  const [fileName, setFileName] = useState("")
  const [error, setError] = useState("")
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState("")
  const [mode, setMode] = useState<"new" | "existing">("new")
  const [targetClientId, setTargetClientId] = useState("")

  async function onFile(file: File) {
    setError(""); setParsed(null); setFileName(file.name)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: "array", cellDates: true })
      const grid = (name: string): Grid =>
        wb.Sheets[name] ? (XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, blankrows: false, defval: "" }) as Grid) : []

      const start = grid("Start Here")
      const client = {
        name: findValue(start, "Your name"),
        agency: findValue(start, "Agency name"),
        email: findValue(start, "Email"),
        currency: findValue(start, "Currency").toUpperCase(),
      }

      const skipped: string[] = []
      const isExample = (r: Grid[number], key: string) =>
        EXAMPLES[key].every((ex, i) => str(r[i]).toLowerCase() === ex)

      const accounts: AccountRow[] = []
      for (const r of dataRows(grid("Accounts & Projects"), "Account")) {
        if (isExample(r, "accounts")) continue
        const accountName = str(r[0]), projectName = str(r[1]), s = ym(r[5])
        if (!accountName || !projectName) { skipped.push(`Accounts: skipped a row missing account/project name`); continue }
        if (!s) { skipped.push(`Accounts: "${projectName}" skipped — Start month must be YYYY-MM`); continue }
        accounts.push({ accountName, projectName, type: normType(r[2]), monthly: num(r[3]), status: normStatus(r[4]), start: s, contractedThrough: ym(r[6]) || null })
      }

      const metrics: MetricRow[] = []
      for (const r of dataRows(grid("Monthly Metrics"), "Month")) {
        if (isExample(r, "metrics")) continue
        const month = ym(r[0])
        if (!month) { skipped.push(`Metrics: skipped a row — Month must be YYYY-MM`); continue }
        metrics.push({ month, revenue: num(r[1]), totalExpenses: num(r[2]), salaries: num(r[3]), software: num(r[4]), cashInBank: num(r[5]), leads: num(r[6]), newClients: num(r[7]), churn: num(r[8]), marketingSpend: num(r[9]) })
      }

      const team: TeamRow[] = []
      for (const r of dataRows(grid("Team"), "Name")) {
        if (isExample(r, "team")) continue
        const name = str(r[0])
        if (!name) continue
        team.push({ name, role: str(r[1]) || undefined, annualSalary: num(r[2]), billableHours: num(r[3]), isExternal: false })
      }

      setParsed({ client, accounts, metrics, team, skipped })
    } catch {
      setError("Couldn't read that file. Make sure it's the .xlsx intake template.")
    }
  }

  const emailValid = !!parsed && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parsed.client.email)
  const canImport = !!parsed && (mode === "existing" ? !!targetClientId : (!!parsed.client.name && emailValid))

  async function runImport() {
    if (!parsed) return
    setImporting(true); setError("")
    try {
      let id: string
      let slug: string | null
      if (mode === "existing") {
        const target = clients.find(c => c.id === targetClientId)
        if (!target) { setError("Pick an existing client to import into."); setImporting(false); return }
        id = target.id; slug = target.slug
        setProgress("Importing into existing client…")
      } else {
        setProgress("Creating client…")
        const res = await fetch("/api/clients", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: parsed.client.name, agency: parsed.client.agency || undefined, email: parsed.client.email, status: "active" }),
        })
        if (!res.ok) { setError("Couldn't create the client. Check the name and email in Start Here."); setImporting(false); return }
        const client = await res.json()
        id = client.id as string; slug = client.slug ?? null
      }

      async function bulk(path: string, rows: unknown[], label: string) {
        if (!rows.length) return
        setProgress(`Importing ${label}…`)
        const r = await fetch(`/api/clients/${id}/${path}`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rows),
        })
        if (!r.ok) throw new Error(`${label} import failed`)
      }
      await bulk("accounts/bulk", parsed.accounts, "accounts & projects")
      await bulk("metrics/bulk", parsed.metrics, "monthly metrics")
      await bulk("people/bulk", parsed.team, "team")

      setProgress("Done — opening client…")
      router.push(`/clients/${slug ?? ""}`)
    } catch (e) {
      setError((e as Error).message + ". Some data may have imported; you can re-run the failed section from the client's tab.")
      setImporting(false)
    }
  }

  const cardStyle: React.CSSProperties = { background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 20, marginBottom: 16 }

  return (
    <div style={{ maxWidth: 780 }}>
      <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 28, fontWeight: 600, margin: "0 0 4px", color: "#1A1916" }}>
        Import from intake sheet
      </h1>
      <p style={{ fontSize: 14, color: "#6F6B64", margin: "0 0 16px", lineHeight: 1.5 }}>
        Upload a completed <strong>Client Intake Template</strong> (.xlsx) to import accounts &amp; projects, monthly metrics, and team in one step — into a new client or one you&apos;ve already created.{" "}
        <a href="/Client-Intake-Template.xlsx" download style={{ color: accent, fontWeight: 600, textDecoration: "none" }}>Download the template ↓</a>
      </p>

      <div style={cardStyle}>
        {/* Destination */}
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9C9590", marginBottom: 10 }}>Import into</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          {([["new", "A new client"], ["existing", "An existing client"]] as const).map(([v, label]) => (
            <button key={v} onClick={() => setMode(v)}
              style={{ padding: "7px 14px", fontSize: 13, fontWeight: 600, borderRadius: 8, cursor: "pointer", border: mode === v ? `1px solid ${accent}` : "1px solid #ECE7DE", background: mode === v ? "#FDEEE9" : "#fff", color: mode === v ? accent : "#6B6760" }}>
              {label}
            </button>
          ))}
        </div>
        {mode === "existing" && (
          <select value={targetClientId} onChange={e => setTargetClientId(e.target.value)}
            style={{ width: "100%", maxWidth: 360, padding: "9px 12px", border: "1px solid #ECE7DE", borderRadius: 8, fontSize: 14, background: "#fff", color: "#1A1916", fontFamily: "inherit", cursor: "pointer", marginBottom: 14 }}>
            <option value="">Select a client…</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        {mode === "existing" && (
          <div style={{ fontSize: 12, color: "#9C9590", marginBottom: 14 }}>The sheet&apos;s name/email in <strong>Start Here</strong> are ignored — projects, metrics, and team import into the selected client.</div>
        )}

        <div style={{ borderTop: "1px solid #F5F1EC", paddingTop: 14 }}>
          <label style={{ display: "inline-block", fontSize: 14, fontWeight: 600, color: "#fff", background: "#1A1916", borderRadius: 9, padding: "11px 20px", cursor: "pointer" }}>
            {fileName ? "Choose a different file" : "Choose intake file (.xlsx)"}
            <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }} />
          </label>
          {fileName && <span style={{ fontSize: 13, color: "#6B6760", marginLeft: 12 }}>{fileName}</span>}
          {error && <div style={{ fontSize: 13, color: "#C2410C", marginTop: 12 }}>{error}</div>}
        </div>
      </div>

      {parsed && (
        <>
          <div style={cardStyle}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9C9590", marginBottom: 10 }}>{mode === "existing" ? "Importing into" : "New client"}</div>
            {mode === "existing" ? (
              <div style={{ fontSize: 15, color: "#1A1916" }}>
                <strong>{clients.find(c => c.id === targetClientId)?.name ?? <span style={{ color: "#C2410C" }}>⚠ pick a client above</span>}</strong>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 15, color: "#1A1916" }}>
                  <strong>{parsed.client.name || <span style={{ color: "#C2410C" }}>⚠ name missing</span>}</strong>
                  {parsed.client.agency ? ` · ${parsed.client.agency}` : ""}
                </div>
                <div style={{ fontSize: 13, color: "#6B6760", marginTop: 2 }}>
                  {parsed.client.email || <span style={{ color: "#C2410C" }}>⚠ email missing</span>}
                  {parsed.client.currency ? ` · ${parsed.client.currency}` : ""}
                </div>
                {parsed.client.currency && parsed.client.currency !== "USD" && (
                  <div style={{ fontSize: 12, color: "#9C9590", marginTop: 6 }}>Set the currency to {parsed.client.currency} in the client&apos;s settings after import.</div>
                )}
              </>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginBottom: 16 }}>
            {[
              { label: "Accounts & projects", n: parsed.accounts.length },
              { label: "Months of metrics", n: parsed.metrics.length },
              { label: "Team members", n: parsed.team.length },
            ].map(s => (
              <div key={s.label} style={{ background: "#fff", border: "1px solid #ECE7DE", borderRadius: 12, padding: 18 }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: accent, fontVariantNumeric: "tabular-nums" }}>{s.n}</div>
                <div style={{ fontSize: 12, color: "#9C9590" }}>{s.label}</div>
              </div>
            ))}
          </div>

          {parsed.skipped.length > 0 && (
            <div style={{ ...cardStyle, background: "#FBF0EB", border: "1px solid #F0C3B0" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#9A3412", marginBottom: 6 }}>{parsed.skipped.length} row{parsed.skipped.length === 1 ? "" : "s"} skipped</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#6B6760", lineHeight: 1.5 }}>
                {parsed.skipped.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}

          <button onClick={runImport} disabled={!canImport || importing}
            style={{ fontSize: 15, fontWeight: 700, color: "#fff", background: canImport ? accent : "#C9C4BC", border: "none", borderRadius: 10, padding: "13px 28px", cursor: canImport && !importing ? "pointer" : "default" }}>
            {importing ? (progress || "Importing…") : "Import & create client →"}
          </button>
          {!canImport && !importing && (
            <div style={{ fontSize: 13, color: "#C2410C", marginTop: 10 }}>
              {mode === "existing" ? "Select an existing client to import into." : "Add the client's name and a valid email in the Start Here tab, then re-upload."}
            </div>
          )}
        </>
      )}
    </div>
  )
}
