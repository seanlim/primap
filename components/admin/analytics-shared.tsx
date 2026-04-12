import type { ComponentType, CSSProperties } from 'react'
import { MapPinned } from 'lucide-react'
import { MapView } from '@/components/map/map-view'
import type { AnalyticsReportMapPoint } from '@/lib/admin-volunteer-analytics'
import { DEFAULT_SIGHTING_COLOR, NOT_SIGHTED_COLOR, SPECIES_COLORS, getSpeciesColor } from '@/lib/constants/species'

type IconComponent = ComponentType<{ className?: string; style?: CSSProperties }>

export function SightingLegend({
  points,
}: {
  points: Array<Pick<AnalyticsReportMapPoint, 'outcome' | 'species'>>
}) {
  const totals = points.reduce(
    (acc, point) => {
      if (point.outcome === 'NOT_SIGHTED') {
        acc.notSightedCount += 1
        return acc
      }

      acc.sightedCount += 1
      if (point.species === 'RBL') acc.rblCount += 1
      if (point.species === 'LTM') acc.ltmCount += 1
      if (point.species === 'DUSKY') acc.duskyCount += 1
      if (point.species === 'OTHER') acc.otherCount += 1
      return acc
    },
    {
      sightedCount: 0,
      notSightedCount: 0,
      rblCount: 0,
      ltmCount: 0,
      duskyCount: 0,
      otherCount: 0,
    }
  )

  return (
    <div className="flex flex-wrap gap-3 text-xs text-gray-600">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Sighted</span>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full ring-2 ring-white shadow-sm" style={{ backgroundColor: DEFAULT_SIGHTING_COLOR }} />
            <span>Total: {totals.sightedCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full ring-2 ring-white shadow-sm" style={{ backgroundColor: SPECIES_COLORS.RBL }} />
            <span>RBL: {totals.rblCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full ring-2 ring-white shadow-sm" style={{ backgroundColor: SPECIES_COLORS.LTM }} />
            <span>LTM: {totals.ltmCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full ring-2 ring-white shadow-sm" style={{ backgroundColor: SPECIES_COLORS.DUSKY }} />
            <span>DUSKY: {totals.duskyCount}</span>
          </div>
          {totals.otherCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full ring-2 ring-white shadow-sm" style={{ backgroundColor: SPECIES_COLORS.OTHER }} />
              <span>OTHER: {totals.otherCount}</span>
            </div>
          )}
        </div>
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Not Sighted</span>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm ring-2 ring-white shadow-sm" style={{ backgroundColor: NOT_SIGHTED_COLOR }} />
            <span>Total: {totals.notSightedCount}</span>
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
  iconBgColor,
  iconColor,
}: {
  title: string
  value: number
  icon: IconComponent
  iconBgColor: string
  iconColor: string
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div
        className="border-b border-gray-100 px-4 py-3.5"
        style={{ background: `linear-gradient(90deg, ${iconBgColor}, rgba(255,255,255,0.96))` }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl ring-1 ring-black/5" style={{ backgroundColor: iconBgColor }}>
            <Icon className="h-5 w-5" style={{ color: iconColor }} />
          </div>
          <p className="text-sm font-semibold uppercase tracking-wider text-gray-500">{title}</p>
        </div>
      </div>
      <div className="px-4 py-4">
        <p className="text-[30px] font-semibold leading-none tracking-[-0.04em] text-gray-900 tabular-nums">{value}</p>
      </div>
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
  reportMapPoints: AnalyticsReportMapPoint[]
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
