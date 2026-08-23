import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft, Search } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface Report {
  walkId: string
  roundId: string | null
  roundName: string | null
  roundStatus: string | null
  roundStartDate: string | null
  locationName: string
  walkDate: string
  startTime: string
  maxVolunteers: number
  memberCount: number
  submittedAt: string
}

/**
 * Raw shape of the embedded observations query below. Defined explicitly so
 * the row mapping doesn't need per-row `as unknown as { ... }` casts.
 */
interface ObservationQueryRow {
  id: string
  slot_id: string
  submitted_at: string | null
  created_at: string
  walk_slots: {
    location_name: string
    walk_date: string
    start_time: string
    max_volunteers: number
    slot_memberships: { user_id: string; status: string; profiles: { full_name: string | null; email: string } | null }[]
    survey_rounds: {
      id: string
      name: string
      status: string
      start_date: string
    } | null
  } | null
}

function matchesDateFilter(report: Report, dateFilter: string) {
  return !dateFilter || report.walkDate === dateFilter
}

function matchesRoundNameFilter(report: Report, query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true
  return (report.roundName || '').toLowerCase().includes(normalized)
}

function matchesRoundStatusFilter(report: Report, status: string) {
  return !status || report.roundStatus === status
}

function matchesLocationFilter(report: Report, query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true
  return report.locationName.toLowerCase().includes(normalized)
}

function matchesWalkStatusFilter(report: Report, status: string) {
  if (!status) return true
  const walkStatus = report.memberCount >= report.maxVolunteers ? 'full' : 'open'
  return walkStatus === status
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    date?: string
    round_name?: string
    round_status?: string
    location?: string
    walk_status?: string
  }>
}) {
  const params = (await searchParams) ?? {}
  const dateFilter = params.date || ''
  const roundNameFilter = params.round_name || ''
  const roundStatusFilter = params.round_status || ''
  const locationFilter = params.location || ''
  const walkStatusFilter = params.walk_status || ''

  const supabase = await createClient()

  const { data: observationsRaw } = await supabase
    .from('observations')
    .select(`
      id,
      slot_id,
      submitted_at,
      created_at,
      walk_slots:slot_id(
        location_name,
        walk_date,
        start_time,
        max_volunteers,
        slot_memberships(user_id, status, profiles:user_id(full_name, email)),
        survey_rounds(id, name, status, start_date)
      )
    `)
    .eq('status', 'SUBMITTED')
    .order('submitted_at', { ascending: false })

  const observations = (observationsRaw || []) as unknown as ObservationQueryRow[]

  const allReports: Report[] = observations
    .filter((obs): obs is ObservationQueryRow & { walk_slots: NonNullable<ObservationQueryRow['walk_slots']> } => obs.walk_slots !== null)
    .map((obs) => {
      const slot = obs.walk_slots
      const activeMembers = (slot.slot_memberships || []).filter(m => m.status === 'ACTIVE')
      const reporter = activeMembers[0]
      const reporterName = reporter?.profiles?.full_name || reporter?.profiles?.email || 'Unknown'

      return {
        walkId: obs.slot_id,
        roundId: slot.survey_rounds?.id || null,
        roundName: slot.survey_rounds?.name || null,
        roundStatus: slot.survey_rounds?.status || null,
        roundStartDate: slot.survey_rounds?.start_date || null,
        locationName: slot.location_name,
        walkDate: slot.walk_date,
        startTime: slot.start_time,
        maxVolunteers: slot.max_volunteers,
        memberCount: activeMembers.length,
        submittedAt: obs.submitted_at || obs.created_at,
        reporterName,
      }
    })
    .sort((a, b) => {
    const leftTime = new Date(`${a.walkDate}T${a.startTime}`).getTime()
    const rightTime = new Date(`${b.walkDate}T${b.startTime}`).getTime()
    return leftTime - rightTime
  })

  const filteredReports = allReports.filter(
    (report) =>
      matchesDateFilter(report, dateFilter) &&
      matchesRoundNameFilter(report, roundNameFilter) &&
      matchesRoundStatusFilter(report, roundStatusFilter) &&
      matchesLocationFilter(report, locationFilter) &&
      matchesWalkStatusFilter(report, walkStatusFilter)
  )

  const reportGroups = Array.from(
    filteredReports.reduce((map, report) => {
      const key = report.roundId || 'unassigned'
      const existing = map.get(key)
      if (existing) {
        existing.reports.push(report)
        return map
      }

      map.set(key, {
        roundId: report.roundId,
        roundName: report.roundName || 'Unassigned Round',
        roundStatus: report.roundStatus,
        roundStartDate: report.roundStartDate,
        reports: [report],
      })
      return map
    }, new Map<string, {
      roundId: string | null
      roundName: string
      roundStatus: string | null
      roundStartDate: string | null
      reports: Report[]
    }>())
  )
    .map(([, group]) => ({
      ...group,
      reports: [...group.reports].sort((left, right) => {
        const leftTime = new Date(`${left.walkDate}T${left.startTime}`).getTime()
        const rightTime = new Date(`${right.walkDate}T${right.startTime}`).getTime()
        return leftTime - rightTime
      }),
    }))
    .sort((left, right) => {
      const leftTime = left.roundStartDate ? new Date(`${left.roundStartDate}T00:00:00`).getTime() : Number.MAX_SAFE_INTEGER
      const rightTime = right.roundStartDate ? new Date(`${right.roundStartDate}T00:00:00`).getTime() : Number.MAX_SAFE_INTEGER
      if (leftTime !== rightTime) return leftTime - rightTime
      return left.roundName.localeCompare(right.roundName)
    })

  const hasFilters = Boolean(dateFilter || roundNameFilter || roundStatusFilter || locationFilter || walkStatusFilter)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
      </div>

      <form className="rounded-xl bg-white p-4 shadow-sm space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
          <input
            type="date"
            name="date"
            defaultValue={dateFilter}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Round Name</label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                name="round_name"
                defaultValue={roundNameFilter}
                placeholder="Search round names..."
                className="w-full px-3 py-2 pl-9 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Round Status</label>
            <select
              name="round_status"
              defaultValue={roundStatusFilter}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">All</option>
              <option value="OPEN">Open</option>
              <option value="CLOSED">Closed</option>
              <option value="DRAFT">Draft</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Walk Location</label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                name="location"
                defaultValue={locationFilter}
                placeholder="Search locations..."
                className="w-full px-3 py-2 pl-9 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Walk Status</label>
            <select
              name="walk_status"
              defaultValue={walkStatusFilter}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">All</option>
              <option value="open">Open</option>
              <option value="full">Full</option>
            </select>
          </div>
        </div>
        {hasFilters && (
          <Link href="/admin/reports" className="text-xs text-gray-500 hover:text-gray-700 underline">
            Clear filters
          </Link>
        )}
      </form>

      {allReports.length === 0 ? (
        <div className="rounded-xl bg-white p-8 text-center shadow-sm">
          <p className="text-gray-500">No reports yet.</p>
        </div>
      ) : reportGroups.length === 0 ? (
        <div className="rounded-xl bg-white p-8 text-center shadow-sm">
          <p className="text-gray-500">No reports match those filters.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {reportGroups.map((group) => (
            <section key={group.roundId || group.roundName} className="overflow-hidden rounded-2xl bg-white shadow-sm">
              <div className="border-b border-gray-100 bg-gray-50/80 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900">{group.roundName}</h2>
                    <p className="mt-1 text-xs text-gray-500">
                      {group.reports.length} walk{group.reports.length === 1 ? '' : 's'} in this round
                    </p>
                  </div>
                  <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-500 ring-1 ring-gray-200">
                    Sorted by date
                  </div>
                </div>
              </div>

              <div className="divide-y divide-gray-100">
                {group.reports.map((report) => (
                  <div key={report.walkId} className="px-4 py-4">
                    <Link
                      href={`/admin/reports/${report.walkId}`}
                      className="block rounded-xl border border-transparent transition-colors hover:border-gray-100 hover:bg-gray-50/60"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 px-1 py-1">
                          <p className="font-medium text-gray-900">{report.locationName}</p>
                          <p className="mt-1 text-sm text-gray-600">
                            {new Date(report.walkDate).toLocaleDateString('en-SG', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                            {report.startTime ? ` · ${report.startTime.slice(0, 5)}` : ''}
                          </p>
                          <div className="mt-3 space-y-1 text-xs text-gray-500">
                            {/* TODO: To add back in issue #105 */}
                            {/* <p className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {report.reporterName}
                            </p> */}
                            <p>Submitted {new Date(report.submittedAt).toLocaleString('en-SG')}</p>
                          </div>
                        </div>
                        <div className="shrink-0 px-1 py-1">
                          <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                            Submitted
                          </span>
                        </div>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
