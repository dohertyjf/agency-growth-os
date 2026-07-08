import "dotenv/config"
import { PrismaClient } from "../app/generated/prisma/client"
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"
import bcrypt from "bcryptjs"

const dbUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db"
const adapter = new PrismaBetterSqlite3({ url: dbUrl })
const prisma = new PrismaClient({ adapter })

async function main() {
  // Clean slate
  await prisma.$executeRawUnsafe("DELETE FROM Question")
  await prisma.$executeRawUnsafe("DELETE FROM Call")
  await prisma.$executeRawUnsafe("DELETE FROM Contract")
  await prisma.$executeRawUnsafe("DELETE FROM Goal")
  await prisma.$executeRawUnsafe("DELETE FROM MonthlyMetric")
  await prisma.$executeRawUnsafe("DELETE FROM InviteToken")
  await prisma.$executeRawUnsafe("DELETE FROM User")
  await prisma.$executeRawUnsafe("DELETE FROM IntakeSubmission")
  await prisma.$executeRawUnsafe("DELETE FROM Client")

  // ── Coach (John Doherty) ────────────────────────────────────────────────────
  const coachHash = await bcrypt.hash("coach1234", 12)
  await prisma.user.create({
    data: {
      email: "john@getcredo.com",
      name: "John Doherty",
      role: "coach",
      passwordHash: coachHash,
    },
  })

  // ── Client: Maria Chen / Apex Studio ────────────────────────────────────────
  const maria = await prisma.client.create({
    data: {
      name: "Maria Chen",
      agency: "Apex Studio",
      email: "maria@apexstudio.co",
      status: "active",
    },
  })

  const mariaHash = await bcrypt.hash("client1234", 12)
  await prisma.user.create({
    data: {
      email: "maria@apexstudio.co",
      name: "Maria Chen",
      role: "client",
      clientId: maria.id,
      passwordHash: mariaHash,
    },
  })

  // Goal
  await prisma.goal.create({
    data: {
      clientId: maria.id,
      annualRevenue: 600000,
      profit: 150000,
    },
  })

  // 12 months of metrics (Jul 2024 – Jun 2025)
  const monthlyData = [
    { month: "2024-07", revenue: 32000, totalExpenses: 22000, salaries: 14000, software: 1800, cashInBank: 45000, leads: 28, newClients: 3, closeRate: 21, churn: 1 },
    { month: "2024-08", revenue: 34500, totalExpenses: 23000, salaries: 14500, software: 1900, cashInBank: 47000, leads: 31, newClients: 4, closeRate: 23, churn: 0 },
    { month: "2024-09", revenue: 36000, totalExpenses: 23500, salaries: 15000, software: 2000, cashInBank: 51000, leads: 33, newClients: 3, closeRate: 24, churn: 1 },
    { month: "2024-10", revenue: 38500, totalExpenses: 24500, salaries: 15500, software: 2100, cashInBank: 55000, leads: 36, newClients: 5, closeRate: 26, churn: 0 },
    { month: "2024-11", revenue: 40000, totalExpenses: 25000, salaries: 16000, software: 2200, cashInBank: 60000, leads: 38, newClients: 4, closeRate: 25, churn: 1 },
    { month: "2024-12", revenue: 42000, totalExpenses: 26000, salaries: 16500, software: 2300, cashInBank: 64000, leads: 35, newClients: 3, closeRate: 22, churn: 2 },
    { month: "2025-01", revenue: 39000, totalExpenses: 25500, salaries: 16500, software: 2400, cashInBank: 58000, leads: 30, newClients: 3, closeRate: 20, churn: 3 },
    { month: "2025-02", revenue: 41000, totalExpenses: 26000, salaries: 17000, software: 2400, cashInBank: 62000, leads: 34, newClients: 4, closeRate: 24, churn: 1 },
    { month: "2025-03", revenue: 44000, totalExpenses: 27000, salaries: 17500, software: 2500, cashInBank: 68000, leads: 38, newClients: 5, closeRate: 26, churn: 0 },
    { month: "2025-04", revenue: 46500, totalExpenses: 27500, salaries: 18000, software: 2600, cashInBank: 73000, leads: 42, newClients: 6, closeRate: 28, churn: 1 },
    { month: "2025-05", revenue: 48000, totalExpenses: 28000, salaries: 18500, software: 2700, cashInBank: 79000, leads: 45, newClients: 5, closeRate: 27, churn: 0 },
    { month: "2025-06", revenue: 50000, totalExpenses: 29000, salaries: 19000, software: 2800, cashInBank: 85000, leads: 48, newClients: 6, closeRate: 29, churn: 1 },
  ]

  for (const m of monthlyData) {
    await prisma.monthlyMetric.create({ data: { clientId: maria.id, ...m } })
  }

  // 8 Contracts
  const contracts = [
    { name: "RetailBridge", monthly: 6500, start: "2024-07", contractedThrough: "2025-06", status: "active" },
    { name: "NovaBuild Co", monthly: 5000, start: "2024-09", contractedThrough: "2025-08", status: "active" },
    { name: "Clarity Health", monthly: 4500, start: "2024-10", contractedThrough: "2025-03", status: "active" },
    { name: "Venture Lanes", monthly: 3800, start: "2025-01", contractedThrough: "2025-12", status: "active" },
    { name: "EchoGrid", monthly: 7200, start: "2025-02", contractedThrough: "2026-01", status: "active" },
    { name: "PeakFlow Apps", monthly: 4000, start: "2025-04", contractedThrough: "2025-09", status: "active" },
    { name: "Sable Digital", monthly: 5500, start: "2025-05", contractedThrough: "2026-04", status: "active" },
    { name: "Orion Media", monthly: 3200, start: "2025-06", contractedThrough: "2025-11", status: "potential" },
  ]

  for (const c of contracts) {
    await prisma.contract.create({ data: { clientId: maria.id, ...c } })
  }

  // 2 Calls
  const call1 = await prisma.call.create({
    data: {
      clientId: maria.id,
      date: "2025-05-15",
      title: "May Strategy Review",
      synopsis: "Maria is hitting her lead targets but close rate has plateaued at ~27%. We identified the discovery call structure as the lever — she's qualifying too late. Next step: add a budget qualification question in the first 5 minutes.",
      notes: "Strong month. Cash position excellent. Consider raising retainer price with next renewal (Clarity Health in March). Revisit churn: one client left due to scope creep.",
    },
  })

  await prisma.question.createMany({
    data: [
      { callId: call1.id, q: "What's stopping you from raising prices?", a: "Fear of losing existing clients. I haven't tested the ceiling yet.", order: 1 },
      { callId: call1.id, q: "Where are deals dying in your pipeline?", a: "After the proposal — I think they're comparing me on price with offshore.", order: 2 },
      { callId: call1.id, q: "What would a 90-day win look like?", a: "Get close rate to 33% and sign one client at $8k+ retainer.", order: 3 },
    ],
  })

  const call2 = await prisma.call.create({
    data: {
      clientId: maria.id,
      date: "2025-06-12",
      title: "June Mid-Month Check-in",
      synopsis: "Short check-in. Orion Media proposal sent ($3,200/mo potential). Pipeline looking strong — 3 qualified leads in final stage. Maria raised Clarity Health renewal conversation.",
      notes: "Orion = potential contract, mark accordingly. Remind Maria to track hours for Q3 — effective hourly rate is a useful signal for team hiring decision.",
    },
  })

  await prisma.question.createMany({
    data: [
      { callId: call2.id, q: "How did the price-raise conversation with Clarity go?", a: "They accepted $5,500 for the renewal. No pushback.", order: 1 },
      { callId: call2.id, q: "Any team hires on the horizon?", a: "Considering a part-time account manager if June closes strong.", order: 2 },
    ],
  })

  // ── Sample prospect (unconverted intake) ────────────────────────────────────
  const prospectData = {
    leads: 22,
    qualifiedLeads: 10,
    newClients: 2,
    newRevenue: 6000,
    totalClients: 8,
    overallRevenue: 21000,
    churnedClients: 1,
    churnedRevenue: 2500,
    marketingSpend: 1800,
    avgMonthsStay: 9,
    peopleCost: 9000,
    hoursForClients: 120,
  }

  const prospectAnswers = {
    q_biggest_challenge: "Getting consistent, high-quality leads without relying on referrals",
    q_revenue_goal: "$500k this year",
    q_bottleneck: "Delivery — I'm still doing too much client work myself",
    q_team: "2 freelancers and 1 part-time VA",
    q_services: "SEO, content strategy, and CRO for e-commerce brands",
    q_ideal_client: "DTC brands doing $2M–$10M revenue who need to grow organic traffic",
    q_referral: "Heard about you on a podcast",
    q_timeline: "Ready to start immediately",
    q_invest: "Can invest up to $2,500/month for coaching",
    q_other: "I've tried hiring a sales person but it didn't work out",
    q_commitment: "Fully committed",
  }

  await prisma.intakeSubmission.create({
    data: {
      email: "james@growthloop.io",
      name: "James Okafor",
      agency: "GrowthLoop",
      data: JSON.stringify(prospectData),
      answers: JSON.stringify(prospectAnswers),
      converted: false,
    },
  })

  console.log("✓ Seed complete")
  console.log("  Coach:  john@getcredo.com / coach1234")
  console.log("  Client: maria@apexstudio.co / client1234")
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
