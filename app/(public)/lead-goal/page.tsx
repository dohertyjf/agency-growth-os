import LeadGoalCalculator from "@/components/LeadGoalCalculator"

export const metadata = {
  title: "Lead Goal Calculator — How many leads to hit your revenue goal?",
  description: "Find the sales conversations per month it takes to reach and hold your revenue goal.",
}

export default async function LeadGoalPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const sp = await searchParams
  const embed = sp.embed === "1" || sp.embed === "true"

  return (
    <div style={{ minHeight: "100vh", background: "#FBFAF7" }}>
      <LeadGoalCalculator embed={embed} />
    </div>
  )
}
