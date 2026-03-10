import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDate } from '@/lib/utils/format-date'
import { WalkFilters } from './walk-filters-client'
import type { MembershipWithProfile } from '@/lib/types/supabase-helpers'

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

  const allSlots = slotsResult.data || []

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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Walks</h1>

      {/* Filters */}
      <WalkFilters />

      {/* My Walks */}
      {mySlots.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">My Walks</h2>
          <div className="space-y-2">
            {mySlots.map((slot) => {
              const activeCount = (slot.slot_memberships as unknown as { status: string }[])
                .filter(m => m.status === 'ACTIVE').length
              return (
                <Link
                  key={slot.id}
                  href={`/report/${slot.id}`}
                  className="block bg-green-50 border border-green-200 rounded-xl p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-gray-900">{slot.location_name}</p>
                      <p className="text-sm text-gray-600 mt-1">
                        {formatDate(slot.walk_date, 'default')}
                      </p>
                      <p className="text-sm text-gray-500">
                        {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                      </p>
                    </div>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                      Joined
                    </span>
                  </div>
                  <div className="mt-2">
                    <span className="text-xs text-gray-500">
                      {activeCount}/{slot.max_volunteers} volunteers
                    </span>
                  </div>
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
          <div className="bg-white rounded-xl p-8 text-center shadow-sm">
            <p className="text-gray-500">No walks available at the moment.</p>
            <p className="text-sm text-gray-400 mt-1">Check back when a new survey round opens.</p>
          </div>
        ) : paginatedSlots.length === 0 ? (
          <div className="bg-white rounded-xl p-6 text-center shadow-sm">
            <p className="text-gray-500 text-sm">
              {hasFilters ? 'No walks match your filters.' : 'No more available walks in this round.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {paginatedSlots.map((slot) => {
              const activeCount = (slot.slot_memberships as unknown as { status: string }[])
                .filter(m => m.status === 'ACTIVE').length
              const isFull = activeCount >= slot.max_volunteers
              return (
                <Link
                  key={slot.id}
                  href={`/walk/${slot.id}`}
                  className={`block bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow ${
                    isFull ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-gray-900">{slot.location_name}</p>
                      <p className="text-sm text-gray-600 mt-1">
                        {formatDate(slot.walk_date, 'default')}
                      </p>
                      <p className="text-sm text-gray-500">
                        {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                      </p>
                    </div>
                    {isFull ? (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full font-medium">Full</span>
                    ) : (
                      <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full font-medium">Open</span>
                    )}
                  </div>
                  <div className="mt-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div
                          className="bg-green-500 h-1.5 rounded-full transition-all"
                          style={{ width: `${(activeCount / slot.max_volunteers) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">
                        {activeCount}/{slot.max_volunteers}
                      </span>
                    </div>
                  </div>
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
