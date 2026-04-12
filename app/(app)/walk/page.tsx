import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDate, getRelativeDay } from '@/lib/utils/format-date'
import { WalkFilters } from './walk-filters-client'
import { MapPin, Calendar, Clock, Users, ChevronRight, Footprints, Search } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { hasWalkStarted } from '@/lib/utils/walk-participation'
import { findCurrentRound } from '@/lib/utils/rounds'
import type { SlotMembership, WalkSlot as DbWalkSlot } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 10

type WalkSlot = DbWalkSlot & {
  slot_memberships: Pick<SlotMembership, 'id' | 'user_id' | 'status'>[]
}

type RoundMeta = {
  id: string
  name: string
  start_date: string
  end_date: string
}

type WalkSlotWithRound = WalkSlot & {
  roundName: string
  roundStartDate: string
  roundEndDate: string
}

function getActiveMembershipCount(slot: Pick<WalkSlot, 'slot_memberships'>) {
  return slot.slot_memberships.filter((membership) => membership.status === 'ACTIVE').length
}

function groupSlotsByRound(slots: WalkSlotWithRound[]) {
  const grouped = new Map<string, {
    roundId: string
    roundName: string
    roundStartDate: string
    roundEndDate: string
    slots: WalkSlotWithRound[]
  }>()

  for (const slot of slots) {
    const existing = grouped.get(slot.round_id)
    if (existing) {
      existing.slots.push(slot)
      continue
    }

    grouped.set(slot.round_id, {
      roundId: slot.round_id,
      roundName: slot.roundName,
      roundStartDate: slot.roundStartDate,
      roundEndDate: slot.roundEndDate,
      slots: [slot],
    })
  }

  return Array.from(grouped.values())
    .map((group) => ({
      ...group,
      slots: [...group.slots].sort((left, right) => {
        const leftTime = new Date(`${left.walk_date}T${left.start_time}`).getTime()
        const rightTime = new Date(`${right.walk_date}T${right.start_time}`).getTime()
        return leftTime - rightTime
      }),
    }))
    .sort((left, right) => {
      const leftTime = new Date(`${left.roundStartDate}T00:00:00`).getTime()
      const rightTime = new Date(`${right.roundStartDate}T00:00:00`).getTime()
      return leftTime - rightTime
    })
}

function sliceGroupedSlotsByPage(
  groups: ReturnType<typeof groupSlotsByRound>,
  from: number,
  to: number
) {
  const paginatedGroups: ReturnType<typeof groupSlotsByRound> = []
  let slotIndex = 0

  for (const group of groups) {
    const groupStart = slotIndex
    const groupEnd = groupStart + group.slots.length
    slotIndex = groupEnd

    if (groupEnd <= from || groupStart >= to) {
      continue
    }

    const sliceStart = Math.max(0, from - groupStart)
    const sliceEnd = Math.min(group.slots.length, to - groupStart)

    paginatedGroups.push({
      ...group,
      slots: group.slots.slice(sliceStart, sliceEnd),
    })
  }

  return paginatedGroups
}

function RoundSection({
  group,
  isCurrentRound,
  joinedCount,
  availableCount,
  children,
}: {
  group: ReturnType<typeof groupSlotsByRound>[number]
  isCurrentRound: boolean
  joinedCount: number
  availableCount: number
  children: React.ReactNode
}) {
  return (
    <section className={`overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 ${
      isCurrentRound ? 'border-l-4 border-l-emerald-500' : ''
    }`}>
      <div className="border-b border-gray-100 bg-gray-50/80 px-4 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {isCurrentRound && (
                <span className="rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
                  Current Round
                </span>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">{group.roundName}</h3>
              <p className="mt-1 text-xs text-gray-500">
                {formatDate(group.roundStartDate, 'compact')} to {formatDate(group.roundEndDate, 'compact')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:min-w-[220px]">
            <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-green-100">
              <p className="text-[11px] uppercase tracking-[0.16em] text-gray-400">Joined</p>
              <p className="mt-1 text-lg font-semibold text-emerald-700">{joinedCount}</p>
            </div>
            <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-blue-100">
              <p className="text-[11px] uppercase tracking-[0.16em] text-gray-400">Available</p>
              <p className="mt-1 text-lg font-semibold text-sky-700">{availableCount}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3 p-3">{children}</div>
    </section>
  )
}

export default async function WalkPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; date?: string; location?: string; availability?: string }>
}) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page || '1', 10))
  const dateFilter = params.date || ''
  const locationFilter = params.location || ''
  const availabilityFilter = params.availability || ''

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get all open rounds with their slots
  const { data: rounds } = await supabase
    .from('survey_rounds')
    .select('*')
    .eq('status', 'OPEN')
    .order('start_date', { ascending: false })

  // Get all slots for open rounds with filters
  const roundIds = (rounds || []).map(r => r.id)

  let slotsQuery = roundIds.length > 0
    ? supabase
        .from('walk_slots')
        .select('*, slot_memberships(id, user_id, status)', { count: 'exact' })
        .in('round_id', roundIds)
        .order('walk_date', { ascending: true })
    : null

  if (slotsQuery) {
    if (dateFilter) {
      slotsQuery = slotsQuery.eq('walk_date', dateFilter)
    }
    if (locationFilter) {
      slotsQuery = slotsQuery.ilike('location_name', `%${locationFilter}%`)
    }
  }

  const slotsResult = slotsQuery
    ? await slotsQuery
    : { data: [], count: 0 }

  const roundMetaById = new Map<string, RoundMeta>(
    (rounds || []).map((round) => [
      round.id,
      {
        id: round.id,
        name: round.name,
        start_date: round.start_date,
        end_date: round.end_date,
      },
    ])
  )
  const currentRound = findCurrentRound(rounds || [])

  const allUpcomingSlots = ((slotsResult.data || []) as WalkSlot[])
    .filter((slot) => !hasWalkStarted(slot.walk_date, slot.start_time))
    .flatMap((slot) => {
      const round = roundMetaById.get(slot.round_id)
      if (!round) {
        return []
      }

      return {
        ...slot,
        roundName: round.name,
        roundStartDate: round.start_date,
        roundEndDate: round.end_date,
      }
    })

  // Get user's active memberships
  const { data: myMemberships } = await supabase
    .from('slot_memberships')
    .select('slot_id')
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')

  const mySlotIds = new Set((myMemberships || []).map(m => m.slot_id))

  const mySlots = allUpcomingSlots.filter(s => mySlotIds.has(s.id))
  const groupedMySlots = groupSlotsByRound(mySlots)

  // Apply availability filter to available slots
  let availableSlots = allUpcomingSlots.filter(s => !mySlotIds.has(s.id))
  if (availabilityFilter === 'open') {
    availableSlots = availableSlots.filter(s => {
      return getActiveMembershipCount(s) < s.max_volunteers
    })
  } else if (availabilityFilter === 'full') {
    availableSlots = availableSlots.filter(s => {
      return getActiveMembershipCount(s) >= s.max_volunteers
    })
  }

  // Paginate available slots
  const totalAvailable = availableSlots.length
  const totalPages = Math.max(1, Math.ceil(totalAvailable / PAGE_SIZE))
  const from = (page - 1) * PAGE_SIZE
  const groupedAvailableSlots = groupSlotsByRound(availableSlots)
  const groupedPaginatedSlots = sliceGroupedSlotsByPage(groupedAvailableSlots, from, from + PAGE_SIZE)
  const paginatedSlots = groupedPaginatedSlots.flatMap((group) => group.slots)
  const availableCountByRoundId = new Map(
    groupedPaginatedSlots.map((group) => [group.roundId, group.slots.length])
  )
  const joinedCountByRoundId = new Map(
    groupedMySlots.map((group) => [group.roundId, group.slots.length])
  )
  const visibleRoundOrder = Array.from(new Set([
    ...groupedMySlots.map((group) => group.roundId),
    ...groupedPaginatedSlots.map((group) => group.roundId),
  ]))
  const groupedMySlotsByRoundId = new Map(groupedMySlots.map((group) => [group.roundId, group]))
  const groupedPaginatedSlotsByRoundId = new Map(groupedPaginatedSlots.map((group) => [group.roundId, group]))

  const hasFilters = dateFilter || locationFilter || availabilityFilter

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-gray-900">Walks</h1>

      {/* Filters */}
      <WalkFilters />

      {/* Walks by Round */}
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              Available Walks
            </h2>
          </div>
          {totalAvailable > 0 && (
            <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-500 ring-1 ring-gray-200">
              {totalAvailable} available
            </div>
          )}
        </div>

        {paginatedSlots.length === 0 && mySlots.length === 0 && !hasFilters ? (
          <EmptyState
            icon={Footprints}
            title="No walks available"
            description="Check back when a new survey round opens"
            color="green"
          />
        ) : paginatedSlots.length === 0 ? (
          <EmptyState
            icon={Search}
            title={hasFilters ? 'No walks match your filters' : 'No more available walks'}
            description={hasFilters ? 'Try adjusting your filters' : undefined}
            color="blue"
          />
        ) : (
          <div className="space-y-5 stagger-children">
            {visibleRoundOrder.map((roundId) => {
              const joinedGroup = groupedMySlotsByRoundId.get(roundId)
              const availableGroup = groupedPaginatedSlotsByRoundId.get(roundId)
              const group = joinedGroup || availableGroup

              if (!group) return null

              return (
                <RoundSection
                  key={roundId}
                  group={group}
                  isCurrentRound={currentRound?.id === roundId}
                  joinedCount={joinedCountByRoundId.get(roundId) ?? 0}
                  availableCount={availableCountByRoundId.get(roundId) ?? 0}
                >
                  {joinedGroup && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 px-1">
                        <div className="h-px flex-1 bg-green-100" />
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-green-700">My Walks</p>
                        <div className="h-px flex-1 bg-green-100" />
                      </div>
                      {joinedGroup.slots.map((slot) => {
                        const activeCount = getActiveMembershipCount(slot)
                        const relDay = getRelativeDay(slot.walk_date)
                        return (
                          <Link
                            key={slot.id}
                            href={`/walk/${slot.id}`}
                            className="flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 p-4 transition-all group hover:scale-[1.01] hover:shadow-md"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <MapPin className="w-3.5 h-3.5 text-green-600 shrink-0" />
                                    <p className="font-semibold text-gray-900 truncate">{slot.location_name}</p>
                                  </div>
                                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-600">
                                    <span className="inline-flex items-center gap-1.5">
                                      <Calendar className="w-3.5 h-3.5 text-green-500 shrink-0" />
                                      {formatDate(slot.walk_date, 'default')}
                                    </span>
                                    <span className="inline-flex items-center gap-1.5">
                                      <Clock className="w-3.5 h-3.5 text-green-500 shrink-0" />
                                      {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                                    </span>
                                    {relDay && (
                                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-green-700 ring-1 ring-green-200">
                                        {relDay}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <span className="rounded-full bg-green-600 px-2.5 py-1 text-xs font-medium text-white shrink-0">
                                  Joined
                                </span>
                              </div>
                              <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-500">
                                <Users className="w-3.5 h-3.5 text-gray-400" />
                                {activeCount}/{slot.max_volunteers} volunteers
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-green-300 group-hover:text-green-600 transition-colors shrink-0" />
                          </Link>
                        )
                      })}
                    </div>
                  )}

                  {availableGroup && (
                    <div className="space-y-2">
                      {availableGroup.slots.map((slot) => {
                        const activeCount = getActiveMembershipCount(slot)
                        const isFull = activeCount >= slot.max_volunteers
                        const relDay = getRelativeDay(slot.walk_date)
                        return (
                          <Link
                            key={slot.id}
                            href={`/walk/${slot.id}`}
                            className={`flex items-center gap-3 rounded-[22px] border p-4 transition-all group ${
                              isFull
                                ? 'border-gray-200 bg-gray-50 opacity-60'
                                : 'border-blue-100 bg-white hover:scale-[1.01] hover:shadow-md'
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                    <p className="font-semibold text-gray-900 truncate">{slot.location_name}</p>
                                  </div>
                                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-600">
                                    <span className="inline-flex items-center gap-1.5">
                                      <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                      {formatDate(slot.walk_date, 'default')}
                                    </span>
                                    <span className="inline-flex items-center gap-1.5">
                                      <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                      {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                                    </span>
                                    {relDay && (
                                      <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 ring-1 ring-sky-100">
                                        {relDay}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {isFull ? (
                                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500 shrink-0">Full</span>
                                ) : (
                                  <span className="rounded-full bg-sky-600 px-2.5 py-1 text-xs font-medium text-white shrink-0">Open</span>
                                )}
                              </div>
                              <div className="mt-3 flex items-center gap-2">
                                <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                                  <div
                                    className="bg-gradient-to-r from-emerald-400 to-sky-500 h-2.5 rounded-full transition-all"
                                    style={{ width: `${(activeCount / slot.max_volunteers) * 100}%` }}
                                  />
                                </div>
                                <div className="flex items-center gap-1 shrink-0 text-xs text-gray-500">
                                  <Users className="w-3.5 h-3.5 text-gray-400" />
                                  {activeCount}/{slot.max_volunteers}
                                </div>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-sky-500 transition-colors shrink-0" />
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </RoundSection>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            {page > 1 && (
              <Link
                href={`/walk?page=${page - 1}${dateFilter ? `&date=${dateFilter}` : ''}${locationFilter ? `&location=${locationFilter}` : ''}${availabilityFilter ? `&availability=${availabilityFilter}` : ''}`}
                className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Previous
              </Link>
            )}
            <span className="text-sm text-gray-500">
              Page {page} of {totalPages}
            </span>
            {page < totalPages && (
              <Link
                href={`/walk?page=${page + 1}${dateFilter ? `&date=${dateFilter}` : ''}${locationFilter ? `&location=${locationFilter}` : ''}${availabilityFilter ? `&availability=${availabilityFilter}` : ''}`}
                className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Next
              </Link>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
