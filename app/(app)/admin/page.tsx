import type { ComponentType } from 'react'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Users, Calendar, AlertTriangle, Settings, ClipboardList, CheckCircle, Gauge, ArrowRight, Footprints, Database } from 'lucide-react'
import { getAdminVolunteerAnalyticsLanding } from '@/lib/admin-volunteer-analytics'

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

export default async function AdminDashboard() {
  const supabase = await createClient()

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
    getAdminVolunteerAnalyticsLanding(supabase),
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

  const overall = analytics.overall

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>

      {overall ? (
        <div className="grid grid-cols-2 gap-4">
          <DonutMetricCard
            title="Completion Rate"
            value={formatPercent(overall.reportCompletionRate)}
            numerator={overall.completionRateSubmittedReports}
            denominator={overall.completionRateExpectedReports}
            numeratorLabel="completed reports"
            denominatorLabel="total reports required"
            progress={overall.reportCompletionRate}
            icon={CheckCircle}
            ringColor="#166534"
            trackColor="#bbf7d0"
            iconBgColor="#f0fdf4"
            iconColor="#15803d"
            accentColor="#16a34a"
          />
          <DonutMetricCard
            title="Sign-up Rate"
            value={formatPercent(overall.capacityFillRate)}
            numerator={overall.walkSignUps}
            denominator={overall.totalVolunteerCapacity}
            numeratorLabel="sign-ups"
            denominatorLabel="total available capacity"
            progress={overall.capacityFillRate}
            icon={Gauge}
            ringColor="#ea580c"
            trackColor="#fed7aa"
            iconBgColor="#fff7ed"
            iconColor="#c2410c"
            accentColor="#ea580c"
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
