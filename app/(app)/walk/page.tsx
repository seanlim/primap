import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDate, getRelativeDay } from '@/lib/utils/format-date'
import { WalkFilters } from './walk-filters-client'
import { MapPin, Calendar, Clock, Users, ChevronRight, Footprints, Search } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { hasWalkStarted } from '@/lib/utils/walk-participation'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 10

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

  const allSlots = (slotsResult.data || []).filter((slot) => !hasWalkStarted(slot.walk_date, slot.start_time))

  // Get user's active memberships
  const { data: myMemberships } = await supabase
    .from('slot_memberships')
    .select('slot_id')
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')

  const mySlotIds = new Set((myMemberships || []).map(m => m.slot_id))

  const mySlots = allSlots.filter(s => mySlotIds.has(s.id))

  // Apply availability filter to available slots
  let availableSlots = allSlots.filter(s => !mySlotIds.has(s.id))
  if (availabilityFilter === 'open') {
    availableSlots = availableSlots.filter(s => {
      const activeCount = (s.slot_memberships as unknown as { status: string }[])
        .filter(m => m.status === 'ACTIVE').length
      return activeCount < s.max_volunteers
    })
  } else if (availabilityFilter === 'full') {
    availableSlots = availableSlots.filter(s => {
      const activeCount = (s.slot_memberships as unknown as { status: string }[])
        .filter(m => m.status === 'ACTIVE').length
      return activeCount >= s.max_volunteers
    })
  }

  // Paginate available slots
  const totalAvailable = availableSlots.length
  const totalPages = Math.max(1, Math.ceil(totalAvailable / PAGE_SIZE))
  const from = (page - 1) * PAGE_SIZE
  const paginatedSlots = availableSlots.slice(from, from + PAGE_SIZE)

  const hasFilters = dateFilter || locationFilter || availabilityFilter

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-gray-900">Walks</h1>

      {/* Filters */}
      <WalkFilters />

      {/* My Walks */}
      {mySlots.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">My Walks</h2>
          <div className="space-y-2 stagger-children">
            {mySlots.map((slot) => {
              const activeCount = (slot.slot_memberships as unknown as { status: string }[])
                .filter(m => m.status === 'ACTIVE').length
              const relDay = getRelativeDay(slot.walk_date)
              return (
                <Link
                  key={slot.id}
                  href={`/walk/${slot.id}`}
                  className="flex items-center gap-3 bg-green-50 border-l-4 border-green-500 rounded-2xl p-4 hover:scale-[1.01] hover:shadow-md transition-all group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-green-600 shrink-0" />
                          <p className="font-semibold text-gray-900 truncate">{slot.location_name}</p>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Calendar className="w-3.5 h-3.5 text-green-500 shrink-0" />
                          <p className="text-sm text-gray-600">
                            {formatDate(slot.walk_date, 'default')}
                          </p>
                          {relDay && (
                            <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">{relDay}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Clock className="w-3.5 h-3.5 text-green-500 shrink-0" />
                          <p className="text-sm text-gray-500">
                            {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs bg-green-600 text-white px-2.5 py-1 rounded-full font-medium shrink-0">
                        Joined
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2">
                      <Users className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-xs text-gray-500">
                        {activeCount}/{slot.max_volunteers} volunteers
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-green-300 group-hover:text-green-600 transition-colors shrink-0" />
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* Available Walks */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
          Available Walks {totalAvailable > 0 && `(${totalAvailable})`}
        </h2>
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
          <div className="space-y-2 stagger-children">
            {paginatedSlots.map((slot) => {
              const activeCount = (slot.slot_memberships as unknown as { status: string }[])
                .filter(m => m.status === 'ACTIVE').length
              const isFull = activeCount >= slot.max_volunteers
              const relDay = getRelativeDay(slot.walk_date)
              return (
                <Link
                  key={slot.id}
                  href={`/walk/${slot.id}`}
                  className={`flex items-center gap-3 bg-white border-l-4 rounded-2xl p-4 shadow-sm transition-all group ${
                    isFull
                      ? 'border-gray-300 opacity-60'
                      : 'border-blue-500 hover:scale-[1.01] hover:shadow-md'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <p className="font-semibold text-gray-900 truncate">{slot.location_name}</p>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <p className="text-sm text-gray-600">
                            {formatDate(slot.walk_date, 'default')}
                          </p>
                          {relDay && (
                            <span className="text-xs font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">{relDay}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <p className="text-sm text-gray-500">
                            {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                          </p>
                        </div>
                      </div>
                      {isFull ? (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full font-medium shrink-0">Full</span>
                      ) : (
                        <span className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded-full font-medium shrink-0">Open</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                        <div
                          className="bg-gradient-to-r from-green-400 to-green-600 h-2.5 rounded-full transition-all"
                          style={{ width: `${(activeCount / slot.max_volunteers) * 100}%` }}
                        />
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Users className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-xs text-gray-500">
                          {activeCount}/{slot.max_volunteers}
                        </span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors shrink-0" />
                </Link>
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
