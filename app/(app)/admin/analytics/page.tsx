import Link from 'next/link'
import { ArrowLeft, BarChart3, CalendarRange, CheckCircle2, ClipboardList, TrendingUp, UserCheck, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getAdminVolunteerAnalytics } from '@/lib/admin-volunteer-analytics'

export const dynamic = 'force-dynamic'

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

function formatAverage(value: number) {
  return value % 1 === 0 ? String(value) : value.toFixed(1)
}

function formatRoundDateRange(startDate: string, endDate: string) {
  const formatOptions = { day: 'numeric', month: 'short', year: 'numeric' } as const
  const start = new Date(startDate).toLocaleDateString('en-SG', formatOptions)
  const end = new Date(endDate).toLocaleDateString('en-SG', formatOptions)
  return `${start} - ${end}`
}

export default async function AdminAnalyticsPage() {
  const supabase = await createClient()
  const analytics = await getAdminVolunteerAnalytics(supabase)

  if (!analytics.targetRound || !analytics.currentRound || !analytics.roundHealth || !analytics.allTime) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Volunteer Analytics</h1>
        </div>

        <div className="bg-white rounded-xl p-8 text-center shadow-sm">
          <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-6 h-6 text-green-600" />
          </div>
          <p className="font-semibold text-gray-900">No survey rounds yet</p>
          <p className="text-sm text-gray-500 mt-2">
            Create a survey round to start tracking volunteer analytics.
          </p>
        </div>
      </div>
    )
  }

  const currentRoundCards = [
    {
      label: 'Participating Volunteers',
      value: analytics.currentRound.participatingVolunteers,
      sub: 'Unique volunteers with active sign-ups',
      icon: Users,
      color: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'Walk Sign-ups',
      value: analytics.currentRound.walkSignUps,
      sub: 'Active volunteer sign-ups this round',
      icon: UserCheck,
      color: 'bg-green-50 text-green-600',
    },
    {
      label: 'Walk Cancellations',
      value: analytics.currentRound.walkCancellations,
      sub: 'Cancelled sign-ups this round',
      icon: CalendarRange,
      color: 'bg-yellow-50 text-yellow-700',
    },
    {
      label: 'Submitted Reports',
      value: analytics.currentRound.submittedReports,
      sub: 'Submitted observations for this round',
      icon: ClipboardList,
      color: 'bg-indigo-50 text-indigo-600',
    },
    {
      label: 'Report Completion Rate',
      value: formatPercent(analytics.currentRound.reportCompletionRate),
      sub: 'Based on sign-ups for walks that have ended',
      icon: CheckCircle2,
      color: 'bg-emerald-50 text-emerald-600',
    },
    {
      label: 'Average Volunteers per Walk',
      value: formatAverage(analytics.currentRound.averageVolunteersPerWalk),
      sub: 'Active sign-ups divided by total walks',
      icon: TrendingUp,
      color: 'bg-purple-50 text-purple-600',
    },
    {
      label: 'Capacity Fill Rate',
      value: formatPercent(analytics.currentRound.capacityFillRate),
      sub: 'Filled volunteer spots across round walks',
      icon: BarChart3,
      color: 'bg-rose-50 text-rose-600',
    },
  ]

  const allTimeCards = [
    {
      label: 'Active Registered Volunteers',
      value: analytics.allTime.activeRegisteredVolunteers,
      sub: 'Active volunteer accounts',
    },
    {
      label: 'Total Volunteer Sign-ups',
      value: analytics.allTime.totalVolunteerSignUps,
      sub: 'All active sign-ups across rounds',
    },
    {
      label: 'Total Volunteer Cancellations',
      value: analytics.allTime.totalVolunteerCancellations,
      sub: 'All cancelled sign-ups across rounds',
    },
    {
      label: 'Total Submitted Reports',
      value: analytics.allTime.totalSubmittedReports,
      sub: 'All submitted observations',
    },
  ]

  const roundHealthCards = [
    { label: 'Total Walks', value: analytics.roundHealth.totalWalks, sub: 'Walk slots in this round' },
    { label: 'Completed Walks', value: analytics.roundHealth.completedWalks, sub: 'Walks that have already ended' },
    { label: 'Upcoming Walks', value: analytics.roundHealth.upcomingWalks, sub: 'Walks still ahead' },
    { label: 'Walks Missing Reports', value: analytics.roundHealth.missingReportWalks, sub: 'Ended walks missing at least one report' },
  ]

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/admin" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Volunteer Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">
            {analytics.targetRound.name} ({analytics.targetRound.status}) · {formatRoundDateRange(analytics.targetRound.start_date, analytics.targetRound.end_date)}
          </p>
        </div>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Current Round Overview</h2>
          <p className="text-sm text-gray-500">Volunteer participation and reporting for the selected survey round.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {currentRoundCards.map((card) => (
            <div key={card.label} className="bg-white rounded-xl p-4 shadow-sm">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${card.color}`}>
                <card.icon className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              <p className="text-sm font-medium text-gray-700 mt-1">{card.label}</p>
              <p className="text-xs text-gray-500 mt-1">{card.sub}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Round Health</h2>
          <p className="text-sm text-gray-500">Quick checks for walk progress and report coverage.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {roundHealthCards.map((card) => (
            <div key={card.label} className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              <p className="text-sm font-medium text-gray-700 mt-1">{card.label}</p>
              <p className="text-xs text-gray-500 mt-1">{card.sub}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">All-Time Volunteer Totals</h2>
          <p className="text-sm text-gray-500">Program-wide context across all survey rounds.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {allTimeCards.map((card) => (
            <div key={card.label} className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              <p className="text-sm font-medium text-gray-700 mt-1">{card.label}</p>
              <p className="text-xs text-gray-500 mt-1">{card.sub}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
