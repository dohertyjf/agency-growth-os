import CapacityCalculator from "@/components/CapacityCalculator"

export const metadata = {
  title: "Agency Capacity Calculator — When does your growth model cap out?",
  description: "Model your agency's revenue forward and find the month your delivery capacity becomes the ceiling.",
}

export default async function CalculatorPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const sp = await searchParams
  const embed = sp.embed === "1" || sp.embed === "true"
  const schedulingUrl = process.env.NEXT_PUBLIC_SCHEDULING_URL || ""

  return (
    <div style={{ minHeight: "100vh", background: "#FBFAF7" }}>
      <CapacityCalculator embed={embed} schedulingUrl={schedulingUrl} />
    </div>
  )
}
