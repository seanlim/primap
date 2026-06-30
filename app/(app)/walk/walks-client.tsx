'use client'
import type { SlotMembership, SurveyRound, WalkSlot as DbWalkSlot } from '@/lib/types/database'
import { formatDate, getRelativeDay } from '@/lib/utils/format-date'
import { findCurrentRound } from '@/lib/utils/rounds'
import { hasWalkStarted } from '@/lib/utils/walk-participation'
import { useMemo, useState } from 'react'
import { EmptyState } from '@/components/ui/empty-state'
import { Calendar, ChevronRight, Clock, Footprints, MapPin, Search, Users } from 'lucide-react'
import WalkCalendar from '@/components/ui/WalkCalendar'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type WalkSlot = Pick<DbWalkSlot, 'id' | 'round_id' | 'location_name' | 'walk_date' | 'start_time' | 'end_time' | 'max_volunteers' >  & {
  slot_memberships: Pick<SlotMembership, 'id' | 'user_id' | 'status'>[]
}

type WalkCalendarSlot = {
  id: string
  locationName: string
  walkDate: string
  startTime: string
  endTime: string
  maxVolunteers: number
  activeCount: number
  isJoined: boolean
}

type RoundMeta = {
  id: string
  name: string
  start_date: string
  end_date: string
}

type WalkSlotWithMetadata = WalkSlot & {
  roundName: string
  roundStartDate: string
  roundEndDate: string
  isJoined: boolean // whether the current user is participating in the slot
}

interface WalksClientProps { 
  rounds: Pick<SurveyRound, 'id' | 'start_date' | 'end_date' | 'name' | 'status'>[]
  walks: WalkSlot[]
  myMemberships: { slot_id: string }[]
}

function getActiveMembershipCount(slot: Pick<WalkSlot, 'slot_memberships'>) {
  return slot.slot_memberships.filter((membership) => membership.status === 'ACTIVE').length
}

function groupSlotsByRound(slots: WalkSlotWithMetadata[]) {
  const grouped = new Map<string, {
    roundId: string
    roundName: string
    roundStartDate: string
    roundEndDate: string
    slots: WalkSlotWithMetadata[]
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

function formatTimeRange(slot: WalkCalendarSlot) {
  return `${slot.startTime.slice(0, 5)} - ${slot.endTime.slice(0, 5)}`
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

export function WalksClient({
  rounds, 
  walks,
  myMemberships,
}: WalksClientProps) {
  const router = useRouter()
  const [locationFilter, setLocationFilter] = useState('')
  const [availabilityFilter, setAvailabilityFilter] = useState('')
  const hasFilters = locationFilter || availabilityFilter

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
  
  const mySlotIds = new Set((myMemberships || []).map(m => m.slot_id))
  const allUpcomingWalks = (walks).filter((slot) => !hasWalkStarted(slot.walk_date, slot.start_time))
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
        isJoined: mySlotIds.has(slot.id)
      }
    })
  const filteredWalkSlots = useMemo(() => {
    const normalizedLocation = locationFilter.trim().toLowerCase()

    return allUpcomingWalks.filter((walk) => {
      const matchesLocation =
        !normalizedLocation || walk.location_name.toLowerCase().includes(normalizedLocation)

      const walkStatus =
        getActiveMembershipCount(walk) >= walk.max_volunteers ? 'full' : 'open'
      const matchesStatus = !availabilityFilter || walkStatus === availabilityFilter

      return matchesLocation && matchesStatus
    })
  }, [locationFilter, availabilityFilter, allUpcomingWalks])

  const groupedFilteredSlots = groupSlotsByRound(filteredWalkSlots)

  const allAvailableSlots = filteredWalkSlots.filter(s => !mySlotIds.has(s.id))
  const totalAvailable = allAvailableSlots.length

  const clearFilter = () => {
    setAvailabilityFilter('')
    setLocationFilter('')
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-gray-900">Walks</h1>
      
      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm flex-row space-y-3">
        <div className="flex gap-3">
          <div className="min-w-32 flex-auto">
            <label htmlFor="walk-location-filter" className="block text-xs font-medium text-gray-500 mb-1">Location</label>
            <input
              id="walk-location-filter"
              type="text"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              placeholder="Search location..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="min-w-16 flex-auto">
            <label htmlFor="walk-availability-filter" className="block text-xs font-medium text-gray-500 mb-1">Availability</label>
            <select
              id="walk-availability-filter"
              value={availabilityFilter}
              onChange={(e) => setAvailabilityFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">All</option>
              <option value="open">Open Only</option>
              <option value="full">Full Only</option>
            </select>
          </div>
        </div>
        {hasFilters && (
          <button
            onClick={clearFilter}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Clear filters
          </button>
        )}
      </div>

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

        {allUpcomingWalks.length === 0 ? (
          <EmptyState
            icon={Footprints}
            title="No walks available"
            description="Check back when a new survey round opens"
            color="green"
          />
        ) : allAvailableSlots.length === 0 && hasFilters ? (
          <EmptyState
            icon={Search}
            title={'No walks match your filters'}
            description={'Try adjusting your filters'}
            color="blue"
          />
        ) : (
          <div className="space-y-5 stagger-children">
            {groupedFilteredSlots.map((group) => {
              const calendarSlots = group.slots.map((slot) => ({
                id: slot.id,
                locationName: slot.location_name,
                walkDate: slot.walk_date,
                startTime: slot.start_time,
                endTime: slot.end_time,
                maxVolunteers: slot.max_volunteers,
                activeCount: getActiveMembershipCount(slot),
                isJoined: slot.isJoined
              }))
              const calendarInitialMonth = new Date() >= new Date(group.roundStartDate + 'T00:00:00') 
              && new Date <= new Date(group.roundEndDate + 'T00:00:00')
                ? new Date() : new Date(group.roundStartDate + 'T00:00:00')    
              const mySlots = group.slots.filter(s => s.isJoined)
              const availableSlots = group.slots.filter(s => !mySlotIds.has(s.id))
              
              return (
                <RoundSection
                  key={group.roundId}
                  group={group}
                  isCurrentRound={currentRound?.id === group.roundId}
                  joinedCount={mySlots.length}
                  availableCount={availableSlots.length}
                >
                  {mySlots.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 px-1">
                        <div className="h-px flex-1 bg-green-100" />
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-green-700">My Walks</p>
                        <div className="h-px flex-1 bg-green-100" />
                      </div>
                      {mySlots.map((slot) => {
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

                  <WalkCalendar
                    events={calendarSlots}
                    initialMonth={calendarInitialMonth}
                    minMonth={group.roundStartDate ? new Date(`${group.roundStartDate}T00:00:00`) : undefined}
                    maxMonth={group.roundEndDate ? new Date(`${group.roundEndDate}T00:00:00`) : undefined}
                    getEventStartTime={(slot) => `${slot.walkDate}T${slot.startTime}`}
                    getEventEndTime={(slot) => `${slot.walkDate}T${slot.endTime}`}
                    eventClassName={(slot) => {
                      if (slot.isJoined) {
                        return 'border-green-200 bg-green-50 text-green-900 hover:border-green-300'
                      }

                      if (slot.activeCount >= slot.maxVolunteers) {
                        return 'border-gray-200 bg-gray-50 text-gray-500 opacity-70'
                      }

                      return 'border-sky-100 bg-sky-50 text-sky-900 hover:border-sky-300'
                    }}
                    renderEvent={(slot) => (
                      <div className="cursor-pointer">
                        <p className="font-semibold">{formatTimeRange(slot)}</p>
                        <p className="truncate">{slot.locationName}</p>
                        <div className="flex flex-row gap-1">
                          <Users className="w-3.5 h-3.5 text-gray-400" />
                          <p>{slot.activeCount}/{slot.maxVolunteers}</p>
                        </div>
                      </div>
                    )}
                    onEventClick={(slot) => router.push(`/walk/${slot.id}`)}
                  />
                </RoundSection>
              )
            })}
          </div>
        )}
      </section>
    </div>
  );
}