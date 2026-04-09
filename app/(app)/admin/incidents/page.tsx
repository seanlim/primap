import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft, Search } from 'lucide-react'
import { IncidentsClient } from './incidents-client'

export const dynamic = 'force-dynamic'

interface IncidentMediaItem {
  id: string
  file_path: string
  file_name: string
  media_type: string
}

interface IncidentItem {
  id: string
  type: string
  description: string
  resolved: boolean
  resolvedNotes: string | null
  reportedBy: string
  locationName: string
  walkDate: string
  createdAt: string
  media: IncidentMediaItem[]
}

/**
 * Raw shape returned by the incidents query below. Defined explicitly so the
 * mapping below doesn't need per-row `as unknown as { ... }` casts — the
 * single cast at the data boundary is the trade-off Supabase asks of us when
 * we use embedded relationships.
 */
interface IncidentQueryRow {
  id: string
  incident_type: string
  description: string
  resolved: boolean
  resolved_notes: string | null
  created_at: string
  profiles: { full_name: string | null; email: string } | null
  media: IncidentMediaItem[] | null
  walk_slots: {
    id: string
    location_name: string
    walk_date: string
    max_volunteers: number
    slot_memberships: { count: number }[]
    survey_rounds: {
      id: string
      name: string
      status: string
      start_date: string
    } | null
  } | null
}

interface IncidentWalkGroup {
  walkId: string
  locationName: string
  walkDate: string
  incidents: IncidentItem[]
}

interface IncidentRoundGroup {
  roundId: string | null
  roundName: string
  roundStartDate: string | null
  walks: IncidentWalkGroup[]
}

function matchesDateFilter(walkDate: string, dateFilter: string) {
  return !dateFilter || walkDate === dateFilter
}

function matchesRoundNameFilter(roundName: string | null, query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true
  return (roundName || '').toLowerCase().includes(normalized)
}

function matchesRoundStatusFilter(roundStatus: string | null, status: string) {
  return !status || roundStatus === status
}

function matchesLocationFilter(locationName: string, query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true
  return locationName.toLowerCase().includes(normalized)
}

function matchesWalkStatusFilter(memberCount: number, maxVolunteers: number, status: string) {
  if (!status) return true
  const walkStatus = memberCount >= maxVolunteers ? 'full' : 'open'
  return walkStatus === status
}

export default async function AdminIncidentsPage({
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

  const { data: incidentsRaw } = await supabase
    .from('incidents')
    .select(`
      id,
      incident_type,
      description,
      resolved,
      resolved_notes,
      created_at,
      profiles:reported_by(full_name, email),
      media:media!media_incident_id_fkey(id, file_path, file_name, media_type),
      walk_slots(
        id,
        location_name,
        walk_date,
        max_volunteers,
        slot_memberships(count),
        survey_rounds(id, name, status, start_date)
      )
    `)
    .order('created_at', { ascending: false })

  const incidents = (incidentsRaw || []) as unknown as IncidentQueryRow[]

  const incidentRows = incidents
    .map((inc) => {
      const walk = inc.walk_slots
      const reporter = inc.profiles
      const media = (inc.media || []).map(m => ({
        id: m.id,
        file_path: m.file_path,
        file_name: m.file_name,
        media_type: m.media_type,
      }))

      return {
        id: inc.id,
        type: inc.incident_type,
        description: inc.description,
        resolved: inc.resolved,
        resolvedNotes: inc.resolved_notes,
        reportedBy: reporter?.full_name || reporter?.email || 'Unknown',
        locationName: walk?.location_name || '',
        walkDate: walk?.walk_date || '',
        createdAt: inc.created_at,
        media,
        walkId: walk?.id || null,
        roundId: walk?.survey_rounds?.id || null,
        roundName: walk?.survey_rounds?.name || null,
        roundStatus: walk?.survey_rounds?.status || null,
        roundStartDate: walk?.survey_rounds?.start_date || null,
        maxVolunteers: walk?.max_volunteers || 0,
        memberCount: walk?.slot_memberships?.[0]?.count || 0,
      }
    })
    .filter((incident) =>
      matchesDateFilter(incident.walkDate, dateFilter) &&
      matchesRoundNameFilter(incident.roundName, roundNameFilter) &&
      matchesRoundStatusFilter(incident.roundStatus, roundStatusFilter) &&
      matchesLocationFilter(incident.locationName, locationFilter) &&
      matchesWalkStatusFilter(incident.memberCount, incident.maxVolunteers, walkStatusFilter)
    )

  const groupedRounds = Array.from(
    incidentRows.reduce((roundMap, incident) => {
      const roundKey = incident.roundId || 'unassigned'
      const existingRound = roundMap.get(roundKey)
      if (existingRound) {
        const walkKey = incident.walkId || `${incident.locationName}-${incident.walkDate}`
        const existingWalk = existingRound.walks.get(walkKey)
        const incidentItem: IncidentItem = {
          id: incident.id,
          type: incident.type,
          description: incident.description,
          resolved: incident.resolved,
          resolvedNotes: incident.resolvedNotes,
          reportedBy: incident.reportedBy,
          locationName: incident.locationName,
          walkDate: incident.walkDate,
          createdAt: incident.createdAt,
          media: incident.media,
        }

        if (existingWalk) {
          existingWalk.incidents.push(incidentItem)
        } else {
          existingRound.walks.set(walkKey, {
            walkId: incident.walkId || walkKey,
            locationName: incident.locationName,
            walkDate: incident.walkDate,
            incidents: [incidentItem],
          })
        }
        return roundMap
      }

      const walkKey = incident.walkId || `${incident.locationName}-${incident.walkDate}`
      roundMap.set(roundKey, {
        roundId: incident.roundId,
        roundName: incident.roundName || 'Unassigned Round',
        roundStartDate: incident.roundStartDate,
        walks: new Map<string, IncidentWalkGroup>([
          [walkKey, {
            walkId: incident.walkId || walkKey,
            locationName: incident.locationName,
            walkDate: incident.walkDate,
            incidents: [{
              id: incident.id,
              type: incident.type,
              description: incident.description,
              resolved: incident.resolved,
              resolvedNotes: incident.resolvedNotes,
              reportedBy: incident.reportedBy,
              locationName: incident.locationName,
              walkDate: incident.walkDate,
              createdAt: incident.createdAt,
              media: incident.media,
            }],
          }],
        ]),
      })
      return roundMap
    }, new Map<string, {
      roundId: string | null
      roundName: string
      roundStartDate: string | null
      walks: Map<string, IncidentWalkGroup>
    }>())
  )
    .map(([, round]) => ({
      roundId: round.roundId,
      roundName: round.roundName,
      roundStartDate: round.roundStartDate,
      walks: Array.from(round.walks.values())
        .map((walk) => ({
          ...walk,
          // Newest incident first within a walk.
          incidents: [...walk.incidents].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          ),
        }))
        // Most recent walk first within a round (matches incident sort).
        .sort((a, b) => new Date(b.walkDate).getTime() - new Date(a.walkDate).getTime()),
    }))
    .sort((a, b) => {
      const leftTime = a.roundStartDate ? new Date(`${a.roundStartDate}T00:00:00`).getTime() : Number.MAX_SAFE_INTEGER
      const rightTime = b.roundStartDate ? new Date(`${b.roundStartDate}T00:00:00`).getTime() : Number.MAX_SAFE_INTEGER
      if (leftTime !== rightTime) return leftTime - rightTime
      return a.roundName.localeCompare(b.roundName)
    }) as IncidentRoundGroup[]

  const hasFilters = Boolean(
    dateFilter || roundNameFilter || roundStatusFilter || locationFilter || walkStatusFilter
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Incidents</h1>
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
          <Link href="/admin/incidents" className="text-xs text-gray-500 hover:text-gray-700 underline">
            Clear filters
          </Link>
        )}
      </form>

      <IncidentsClient incidentGroups={groupedRounds} />
    </div>
  )
}
