import Link from 'next/link'
import { ArrowLeft, CheckCircle, Gauge, UserMinus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getAdminWalksAnalyticsPageSnapshotByRound } from '@/lib/admin-volunteer-analytics'
import { ReportMapCard, SummaryCard } from '@/components/admin/analytics-shared'
import { WalkAnalyticsFilters } from './walk-analytics-filters'
import DonutMetricCard from '@/components/ui/DonutMetricCard'

export const dynamic = 'force-dynamic'

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}
export default async function AdminWalksAnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<{ round?: string; walk?: string }>
}) {
  const params = (await searchParams) ?? {}
  const supabase = await createClient()
  const analytics = await getAdminWalksAnalyticsPageSnapshotByRound(
    supabase as unknown as Parameters<typeof getAdminWalksAnalyticsPageSnapshotByRound>[0],
    {
      roundId: params.round ?? null,
      walkId: params.walk ?? null,
    }
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/walks" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Walk Analytics</h1>
      </div>

      {analytics.availableRounds.length === 0 ? (
        <div className="rounded-xl bg-white p-8 text-center shadow-sm">
          <p className="text-gray-500">No walks yet.</p>
        </div>
      ) : (
        <>
          <WalkAnalyticsFilters
            rounds={analytics.availableRounds.map((round) => ({
              id: round.id,
              name: round.name,
            }))}
            walks={analytics.availableWalks.map((walk) => ({
              id: walk.id,
              label: walk.label,
            }))}
            selectedRoundId={analytics.targetRound?.id ?? ''}
            selectedWalkId={analytics.targetWalk?.id ?? ''}
          />

          {analytics.targetWalk && analytics.overview ? (
            <>
              <div className="rounded-xl bg-white p-4 shadow-sm">
                <h2 className="text-base font-semibold text-gray-900">{analytics.targetWalk.location_name}</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {analytics.targetWalkRoundName ? `${analytics.targetWalkRoundName} · ` : ''}
                  {new Date(analytics.targetWalk.walk_date).toLocaleDateString('en-SG')} · {analytics.targetWalk.start_time.slice(0, 5)}
                </p>
              </div>

              <ReportMapCard
                title="Sighting Map"
                description={
                  analytics.reportMapPoints.length === 0
                    ? 'No report coordinates have been submitted for this walk yet.'
                    : `${analytics.reportMapPoints.length} report coordinate${analytics.reportMapPoints.length === 1 ? '' : 's'} plotted for this walk.`
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

              <div className="grid grid-cols-1 gap-4">
                <SummaryCard
                  title="Cancellations"
                  value={analytics.overview.cancellations}
                  icon={UserMinus}
                  accentColor="#dc2626"
                  iconBgColor="#fef2f2"
                  iconColor="#dc2626"
                />
              </div>
            </>
          ) : (
            <div className="rounded-xl bg-white p-8 text-center shadow-sm">
              <p className="text-gray-500">No walks are available in this round.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
