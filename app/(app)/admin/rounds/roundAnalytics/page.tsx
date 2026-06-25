import Link from 'next/link'
import { ArrowLeft, CheckCircle, Gauge, Footprints, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getAdminRoundsAnalyticsPageSnapshot, type SupabaseClientLike } from '@/lib/admin-volunteer-analytics'
import DonutMetricCard from '../../../../../components/ui/DonutMetricCard'
import { ReportMapCard, SummaryCard } from '@/components/admin/analytics-shared'

export const dynamic = 'force-dynamic'

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}
export default async function AdminRoundsAnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<{ round?: string }>
}) {
  const params = (await searchParams) ?? {}
  const supabase = await createClient()
  const analyticsClient = supabase as unknown as SupabaseClientLike
  const analytics = await getAdminRoundsAnalyticsPageSnapshot(
    analyticsClient,
    {
      roundId: params.round ?? null,
    }
  )

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

              <ReportMapCard
                title="Sighting Map"
                description={
                  analytics.reportMapPoints.length === 0
                    ? 'No report coordinates have been submitted for this round yet.'
                    : `${analytics.reportMapPoints.length} report coordinate${analytics.reportMapPoints.length === 1 ? '' : 's'} plotted for this round.`
                }
                reportMapPoints={analytics.reportMapPoints}
              />

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
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <SummaryCard
                  title="Total Walks"
                  value={analytics.overview.totalWalks}
                  icon={Footprints}
                  iconBgColor="#faf5ff"
                  iconColor="#9333ea"
                />
                <SummaryCard
                  title="Total Volunteers"
                  value={analytics.overview.participatingVolunteers}
                  icon={Users}
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
