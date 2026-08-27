import CapacityLiveTool from "@/components/CapacityLiveTool"

export const metadata = {
  title: "The Growth Gap — what your numbers say you'll actually hit",
  description: "See the gap between the revenue your model produces and the goal you set, and what it costs to leave it alone.",
}

// The diagnostic cut of the growth tool, for sales conversations. Same engine as
// /growthreport; it states the gap and names the constraint but withholds the
// fix, because the page should not answer the question the call is for.
export default function GrowthGapPage() {
  const schedulingUrl = process.env.NEXT_PUBLIC_SCHEDULING_URL || ""

  return (
    <div style={{ minHeight: "100vh", background: "#FBFAF7" }}>
      <div style={{ maxWidth: 940, margin: "0 auto", padding: "40px 24px" }}>
        <CapacityLiveTool
          mode="diagnose"
          schedulingUrl={schedulingUrl}
          title="Will your current model get you there?"
          subtitle="Enter your real numbers. Nothing is saved or sent anywhere."
        />
      </div>
    </div>
  )
}
