import CapacityLiveTool from "@/components/CapacityLiveTool"

export const metadata = {
  title: "Growth Report — where does your agency's model cap out?",
  description: "Enter your numbers and see the month your delivery capacity becomes the ceiling.",
}

// Public, ungated version of the live growth-projection tool — built for
// workshops. Everything is computed in the browser: no login, no email gate,
// nothing written to the database.
export default function GrowthReportPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#FBFAF7" }}>
      <div style={{ maxWidth: 940, margin: "0 auto", padding: "40px 24px" }}>
        <CapacityLiveTool
          title="Where does your growth model cap out?"
          subtitle="Enter your own numbers — the chart updates as you type. Nothing is saved or sent anywhere."
        />
      </div>
    </div>
  )
}
