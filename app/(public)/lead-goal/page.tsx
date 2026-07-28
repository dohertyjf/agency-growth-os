import LeadGoalCalculator from "@/components/LeadGoalCalculator"

export const metadata = {
  title: "Lead Goal Calculator — How many leads to hit your revenue goal?",
  description: "Find the qualified leads per month it takes to reach and hold your revenue goal.",
}

// Static page (no request-time data) — served from the CDN, no cold render.
export default function LeadGoalPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#FBFAF7" }}>
      <LeadGoalCalculator />
    </div>
  )
}
