import type { ComponentType } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle, Gauge, ArrowRight, Footprints, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getAdminRoundsAnalyticsPageSnapshot } from '@/lib/admin-volunteer-analytics'

export const dynamic = 'force-dynamic'

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

function DonutMetricCard({
  title,
  value,
  numerator,
  denominator,
  numeratorLabel,
  denominatorLabel,
  progress,
  icon: Icon,
  ringColor,
  trackColor,
  iconBgColor,
  iconColor,
  accentColor,
}: {
  title: string
  value: string
  numerator: number
  denominator: number
  numeratorLabel: string
  denominatorLabel: string
  progress: number
  icon: ComponentType<{ className?: string }>
  ringColor: string
  trackColor: string
  iconBgColor: string
  iconColor: string
  accentColor: string
}) {
  const boundedProgress = Math.max(0, Math.min(progress, 1))
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - boundedProgress)

  return (
    <div
      className="min-w-0 rounded-2xl border-l-4 bg-white p-4 shadow-sm"
      style={{ borderLeftColor: accentColor }}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: iconBgColor }}>
          <Icon className="h-5 w-5" style={{ color: iconColor }} />
        </div>
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      </div>

      <div className="mt-4 flex items-start gap-3">
        <div className="relative h-36 w-36 shrink-0">
          <svg viewBox="0 0 92 92" className="h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="46" cy="46" r={radius} fill="none" stroke={trackColor} strokeWidth="10" />
            <circle
              cx="46"
              cy="46"
              r={radius}
              fill="none"
              stroke={ringColor}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-gray-900">{value}</div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="grid w-full gap-2">
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{numeratorLabel}</div>
              <div className="mt-1 text-xl font-bold text-gray-900">{numerator}</div>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{denominatorLabel}</div>
              <div className="mt-1 text-xl font-bold text-gray-900">{denominator}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  accentColor,
  iconBgColor,
  iconColor,
}: {
  title: string
  value: number
  icon: ComponentType<{ className?: string }>
  accentColor: string
  iconBgColor: string
  iconColor: string
}) {
  return (
    <div
      className="rounded-2xl border-l-4 bg-white p-4 shadow-sm"
      style={{ borderLeftColor: accentColor }}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: iconBgColor }}>
          <Icon className="h-5 w-5" style={{ color: iconColor }} />
        </div>
        <p className="text-sm font-semibold text-gray-900">{title}</p>
      </div>
      <p className="mt-4 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  )
}

export default async function AdminRoundsAnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<{ round?: string }>
}) {
  const params = (await searchParams) ?? {}
  const supabase = await createClient()
  const analytics = await getAdminRoundsAnalyticsPageSnapshot(supabase, {
    roundId: params.round ?? null,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/rounds" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Round Analytics</h1>
      </div>

      {analytics.availableRounds.length === 0 ? (
        <div className="rounded-xl bg-white p-8 text-center shadow-sm">
          <p className="text-gray-500">No survey rounds yet.</p>
        </div>
      ) : (
        <>
          <form className="rounded-xl bg-white p-4 shadow-sm space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Round</label>
              <div className="flex gap-3">
                <select
                  name="round"
                  defaultValue={analytics.targetRound?.id ?? ''}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {analytics.availableRounds.map((round) => (
                    <option key={round.id} value={round.id}>
                      {round.name}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                >
                  View
                </button>
              </div>
            </div>
          </form>

          {analytics.targetRound && analytics.overview ? (
            <>
              <div className="rounded-xl bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">{analytics.targetRound.name}</h2>
                    <p className="mt-1 text-sm text-gray-500">
                      {new Date(analytics.targetRound.start_date).toLocaleDateString('en-SG')} - {new Date(analytics.targetRound.end_date).toLocaleDateString('en-SG')}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    analytics.targetRound.status === 'OPEN'
                      ? 'bg-green-100 text-green-700'
                      : analytics.targetRound.status === 'CLOSED'
                      ? 'bg-gray-100 text-gray-600'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {analytics.targetRound.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <DonutMetricCard
                  title="Completion Rate"
                  value={formatPercent(analytics.overview.reportCompletionRate)}
                  numerator={analytics.overview.completionRateSubmittedReports}
                  denominator={analytics.overview.completionRateExpectedReports}
                  numeratorLabel="completed reports"
                  denominatorLabel="total reports required"
                  progress={analytics.overview.reportCompletionRate}
                  icon={CheckCircle}
                  ringColor="#166534"
                  trackColor="#bbf7d0"
                  iconBgColor="#f0fdf4"
                  iconColor="#15803d"
                  accentColor="#16a34a"
                />
                <DonutMetricCard
                  title="Sign-up Rate"
                  value={formatPercent(analytics.overview.capacityFillRate)}
                  numerator={analytics.overview.walkSignUps}
                  denominator={analytics.overview.totalVolunteerCapacity}
                  numeratorLabel="sign-ups"
                  denominatorLabel="total available capacity"
                  progress={analytics.overview.capacityFillRate}
                  icon={Gauge}
                  ringColor="#ea580c"
                  trackColor="#fed7aa"
                  iconBgColor="#fff7ed"
                  iconColor="#c2410c"
                  accentColor="#ea580c"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <SummaryCard
                  title="Total Walks"
                  value={analytics.overview.totalWalks}
                  icon={Footprints}
                  accentColor="#9333ea"
                  iconBgColor="#faf5ff"
                  iconColor="#9333ea"
                />
                <SummaryCard
                  title="Total Volunteers"
                  value={analytics.overview.participatingVolunteers}
                  icon={Users}
                  accentColor="#2563eb"
                  iconBgColor="#eff6ff"
                  iconColor="#2563eb"
                />
              </div>
            </>
          ) : null}
        </>
      )}
    </div>
  )
}
