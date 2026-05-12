import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Users, Calendar, AlertTriangle, Settings, ClipboardList, CheckCircle, Gauge, ArrowRight, Footprints, Database } from 'lucide-react'
import { getAdminVolunteerAnalyticsLanding, type SupabaseClientLike } from '@/lib/admin-volunteer-analytics'
import { formatDate } from '@/lib/utils/format-date'
import DonutMetricCard from '../../../components/ui/DonutMetricCard'
import { ReportMapCard } from '@/components/admin/analytics-shared'

export const dynamic = 'force-dynamic'

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

const currentRoundCardColors = {
  accent: '#16a34a',
  accentDark: '#15803d',
  accentSoft: '#f0fdf4',
  accentBorder: '#bbf7d0',
  panelBorder: '#dcfce7',
  neutralBorder: '#f3f4f6',
  tealSoft: '#f0fdfa',
  tealBorder: '#ccfbf1',
  tealText: '#0f766e',
}

export default async function AdminDashboard() {
  const supabase = await createClient()
  const analyticsClient = supabase as unknown as SupabaseClientLike

  const [
    { count: totalUsers },
    { count: pendingUsers },
    { count: activeRounds },
    { count: totalWalks },
    { count: totalObservations },
    { count: openIncidents },
    analytics,
  ] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
    supabase.from('survey_rounds').select('id', { count: 'exact', head: true }).eq('status', 'OPEN'),
    supabase.from('walk_slots').select('id', { count: 'exact', head: true }),
    supabase.from('observations').select('id', { count: 'exact', head: true }).eq('status', 'SUBMITTED'),
    supabase.from('incidents').select('id', { count: 'exact', head: true }).eq('resolved', false),
    getAdminVolunteerAnalyticsLanding(analyticsClient),
  ])

  const cards = [
    { label: 'Users', value: totalUsers || 0, sub: `${pendingUsers || 0}`, subLabel: 'Pending', footerLabel: 'Total', href: '/admin/users', icon: Users, color: 'bg-blue-50 text-blue-600', accentColor: '#2563eb' },
    { label: 'Rounds', value: activeRounds || 0, sub: 'Open', href: '/admin/rounds', icon: Calendar, color: 'bg-green-50 text-green-600', accentColor: '#16a34a' },
    { label: 'Walks', value: totalWalks || 0, sub: 'Total', href: '/admin/walks', icon: Footprints, color: 'bg-purple-50 text-purple-600', accentColor: '#9333ea' },
    { label: 'Reports', value: totalObservations || 0, sub: 'Submitted', href: '/admin/reports', icon: ClipboardList, color: 'bg-indigo-50 text-indigo-600', accentColor: '#4f46e5' },
    { label: 'Incidents', value: openIncidents || 0, sub: 'Open', href: '/admin/incidents', icon: AlertTriangle, color: 'bg-red-50 text-red-600', accentColor: '#dc2626' },
    { label: 'Data', value: '', sub: '', href: '/admin/data', icon: Database, color: 'bg-orange-50 text-orange-600', reserveValueSpace: true, accentColor: '#f97316' },
    { label: 'Settings', value: '', sub: '', href: '/admin/settings', icon: Settings, color: 'bg-gray-50 text-gray-600', reserveValueSpace: true, accentColor: '#9ca3af' },
  ]

  const currentRound = analytics.currentRound
  const targetRound = analytics.targetRound

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>

      {targetRound ? (
        <section
          aria-labelledby="current-round-heading"
          className="overflow-hidden rounded-2xl border border-l-4 bg-white shadow-sm"
          style={{
            borderColor: currentRoundCardColors.neutralBorder,
            borderLeftColor: currentRoundCardColors.accent,
          }}
        >
          <div
            className="border-b px-4"
            style={{
              background: `linear-gradient(90deg, ${currentRoundCardColors.accentSoft}, rgba(255,255,255,0.96))`,
              borderBottomColor: currentRoundCardColors.accentBorder,
              paddingTop: '16px',
              paddingBottom: '16px',
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1 ring-black/5"
                  style={{
                    backgroundColor: currentRoundCardColors.accent,
                    color: '#ffffff',
                  }}
                >
                  <Calendar className="h-5 w-5" />
                </div>
                <p
                  id="current-round-heading"
                  className="truncate text-sm font-semibold uppercase tracking-wider"
                  style={{ color: currentRoundCardColors.accentDark }}
                >
                  Current Round
                </p>
              </div>
              <div
                className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide shadow-sm ring-1 ring-black/5"
                style={{
                  backgroundColor: currentRoundCardColors.accent,
                  color: '#ffffff',
                }}
              >
                {targetRound.status}
              </div>
            </div>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.6fr)]">
            <div
              className="rounded-xl border p-3"
              style={{
                backgroundColor: currentRoundCardColors.accentSoft,
                borderColor: currentRoundCardColors.panelBorder,
              }}
            >
              <div
                className="text-[11px] font-semibold uppercase tracking-[0.16em]"
                style={{ color: currentRoundCardColors.accentDark }}
              >
                Round
              </div>
              <div className="mt-1 truncate text-xl font-bold text-gray-900">{targetRound.name}</div>
            </div>
            <div
              className="rounded-xl border p-3"
              style={{
                backgroundColor: currentRoundCardColors.tealSoft,
                borderColor: currentRoundCardColors.tealBorder,
              }}
            >
              <div
                className="text-[11px] font-semibold uppercase tracking-[0.16em]"
                style={{ color: currentRoundCardColors.tealText }}
              >
                Period
              </div>
              <div className="mt-1 text-sm font-medium text-gray-800">
                {formatDate(targetRound.start_date, 'compact')} to {formatDate(targetRound.end_date, 'compact')}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <ReportMapCard
        title="Sighting Map"
        description={
          analytics.reportMapPoints.length === 0
            ? 'No report coordinates have been submitted for the current round yet.'
            : `${analytics.reportMapPoints.length} report coordinate${analytics.reportMapPoints.length === 1 ? '' : 's'} plotted for ${targetRound?.name ?? 'the current round'}.`
        }
        reportMapPoints={analytics.reportMapPoints}
      />

      {currentRound ? (
        <div className="grid grid-cols-2 gap-4">
          <DonutMetricCard
            title="Completion Rate"
            value={formatPercent(currentRound.reportCompletionRate)}
            numerator={currentRound.completionRateSubmittedReports}
            denominator={currentRound.completionRateExpectedReports}
            numeratorLabel="completed reports"
            denominatorLabel="total reports required"
            progress={currentRound.reportCompletionRate}
            icon={CheckCircle}
            ringColor="#166534"
            trackColor="#bbf7d0"
            iconBgColor="#f0fdf4"
            iconColor="#15803d"
          />
          <DonutMetricCard
            title="Sign-up Rate"
            value={formatPercent(currentRound.capacityFillRate)}
            numerator={currentRound.walkSignUps}
            denominator={currentRound.totalVolunteerCapacity}
            numeratorLabel="sign-ups"
            denominatorLabel="total available capacity"
            progress={currentRound.capacityFillRate}
            icon={Gauge}
            ringColor="#ea580c"
            trackColor="#fed7aa"
            iconBgColor="#fff7ed"
            iconColor="#c2410c"
          />
        </div>
      ) : (
        <div className="rounded-xl bg-white p-4 text-sm text-gray-500 shadow-sm">
          No volunteer analytics available yet.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {cards.map(card => (
          <Link
            key={card.label}
            href={card.href}
            className="flex h-full min-h-[140px] flex-col rounded-2xl border-l-4 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            style={{ borderLeftColor: card.accentColor }}
          >
            <div className="mb-3 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.color}`}>
                <card.icon className="w-5 h-5" />
              </div>
              <p className="text-sm font-semibold text-gray-900">{card.label}</p>
            </div>
            {card.value !== '' && (
              <div className="flex items-end gap-2">
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                {'subLabel' in card && card.subLabel ? (
                  <div className="rounded-lg bg-gray-50 px-3 py-1.5">
                    <p className="text-sm text-gray-500">
                      {card.sub} {card.subLabel}
                    </p>
                  </div>
                ) : null}
              </div>
            )}
            {card.value === '' && card.reserveValueSpace && (
              <div className="h-8" aria-hidden="true" />
            )}
            <div className="mt-2 flex items-end justify-between gap-3">
              {'footerLabel' in card && card.footerLabel ? (
                <p className="text-sm text-gray-500">{card.footerLabel}</p>
              ) : !('subLabel' in card) && card.sub ? (
                <p className="text-sm text-gray-500">{card.sub}</p>
              ) : <span />}
              <ArrowRight className="h-4 w-4 text-gray-300" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
