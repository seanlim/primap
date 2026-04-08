import type { ComponentType, CSSProperties } from 'react'
import { MapPinned } from 'lucide-react'
import { MapView } from '@/components/map/map-view'
import { DEFAULT_SIGHTING_COLOR, NOT_SIGHTED_COLOR, SPECIES_COLORS, getSpeciesColor } from '@/lib/constants/species'

type IconComponent = ComponentType<{ className?: string; style?: CSSProperties }>

export type AdminReportMapPoint = {
  lat: number
  lng: number
  outcome: 'SIGHTED' | 'NOT_SIGHTED'
  label: string
  popupMeta: string[]
  species?: string
}

export function SightingLegend({
  points,
}: {
  points: Array<{ outcome: 'SIGHTED' | 'NOT_SIGHTED'; species?: string }>
}) {
  const sightedCount = points.filter((point) => point.outcome === 'SIGHTED').length
  const notSightedCount = points.filter((point) => point.outcome === 'NOT_SIGHTED').length
  const rblCount = points.filter((point) => point.outcome === 'SIGHTED' && point.species === 'RBL').length
  const ltmCount = points.filter((point) => point.outcome === 'SIGHTED' && point.species === 'LTM').length
  const duskyCount = points.filter((point) => point.outcome === 'SIGHTED' && point.species === 'DUSKY').length
  const otherCount = points.filter((point) => point.outcome === 'SIGHTED' && point.species === 'OTHER').length

  return (
    <div className="flex flex-wrap gap-3 text-xs text-gray-600">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Sighted</span>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full ring-2 ring-white shadow-sm" style={{ backgroundColor: DEFAULT_SIGHTING_COLOR }} />
            <span>Total: {sightedCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full ring-2 ring-white shadow-sm" style={{ backgroundColor: SPECIES_COLORS.RBL }} />
            <span>RBL: {rblCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full ring-2 ring-white shadow-sm" style={{ backgroundColor: SPECIES_COLORS.LTM }} />
            <span>LTM: {ltmCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full ring-2 ring-white shadow-sm" style={{ backgroundColor: SPECIES_COLORS.DUSKY }} />
            <span>DUSKY: {duskyCount}</span>
          </div>
          {otherCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full ring-2 ring-white shadow-sm" style={{ backgroundColor: SPECIES_COLORS.OTHER }} />
              <span>OTHER: {otherCount}</span>
            </div>
          )}
        </div>
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Not Sighted</span>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm ring-2 ring-white shadow-sm" style={{ backgroundColor: NOT_SIGHTED_COLOR }} />
            <span>Total: {notSightedCount}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function DonutMetricCard({
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
  icon: IconComponent
  ringColor: string
  trackColor: string
  iconBgColor: string
  iconColor: string
  accentColor: string
}) {
  const boundedProgress = Math.max(0, Math.min(progress, 1))
  const radius = 31
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - boundedProgress)

  return (
    <div className="min-w-0 rounded-2xl border-l-4 bg-white p-4 shadow-sm" style={{ borderLeftColor: accentColor }}>
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: iconBgColor }}>
          <Icon className="h-[18px] w-[18px]" style={{ color: iconColor }} />
        </div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{title}</h2>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <div className="relative h-28 w-28 shrink-0">
          <svg viewBox="0 0 84 84" className="h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="42" cy="42" r={radius} fill="none" stroke={trackColor} strokeWidth="8" />
            <circle
              cx="42"
              cy="42"
              r={radius}
              fill="none"
              stroke={ringColor}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-xl font-bold text-gray-900">{value}</div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="grid w-full grid-cols-2 gap-2">
            <div className="flex min-h-[88px] flex-col rounded-lg bg-gray-50 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 whitespace-normal break-words">
                {numeratorLabel}
              </div>
              <div className="mt-auto text-right text-xl font-bold text-gray-900">{numerator}</div>
            </div>
            <div className="flex min-h-[88px] flex-col rounded-lg bg-gray-50 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 whitespace-normal break-words">
                {denominatorLabel}
              </div>
              <div className="mt-auto text-right text-xl font-bold text-gray-900">{denominator}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function SummaryCard({
  title,
  value,
  icon: Icon,
  accentColor,
  iconBgColor,
  iconColor,
}: {
  title: string
  value: number
  icon: IconComponent
  accentColor: string
  iconBgColor: string
  iconColor: string
}) {
  return (
    <div className="rounded-2xl border-l-4 bg-white p-4 shadow-sm" style={{ borderLeftColor: accentColor }}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: iconBgColor }}>
          <Icon className="h-5 w-5" style={{ color: iconColor }} />
        </div>
        <p className="text-sm font-semibold uppercase tracking-wider text-gray-500">{title}</p>
      </div>
      <p className="mt-4 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  )
}

export function ReportMapCard({
  title,
  description,
  reportMapPoints,
}: {
  title: string
  description: string
  reportMapPoints: AdminReportMapPoint[]
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
          <MapPinned className="h-5 w-5 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{title}</h2>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
      </div>

      <SightingLegend points={reportMapPoints} />

      <MapView
        className="h-80 w-full overflow-hidden rounded-2xl"
        markers={reportMapPoints.map((location, index) => ({
          ...location,
          color: location.outcome === 'SIGHTED' ? getSpeciesColor(location.species) : NOT_SIGHTED_COLOR,
          variant: location.outcome === 'SIGHTED' ? 'sighted' : 'not_sighted',
          label: location.label || `Report ${index + 1}`,
          popupMeta: location.popupMeta,
        }))}
      />
    </div>
  )
}
