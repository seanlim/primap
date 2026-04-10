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
