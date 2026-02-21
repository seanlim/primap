import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function WalkPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get all open rounds with their slots
  const { data: rounds } = await supabase
    .from('survey_rounds')
    .select('*')
    .eq('status', 'OPEN')
    .order('start_date', { ascending: false })

  // Get all slots for open rounds
  const roundIds = (rounds || []).map(r => r.id)
  const { data: slots } = roundIds.length > 0
    ? await supabase
        .from('walk_slots')
        .select('*, slot_memberships(id, user_id, status)')
        .in('round_id', roundIds)
        .order('walk_date', { ascending: true })
    : { data: [] }

  // Get user's active memberships
  const { data: myMemberships } = await supabase
    .from('slot_memberships')
    .select('slot_id')
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')

  const mySlotIds = new Set((myMemberships || []).map(m => m.slot_id))

  const mySlots = (slots || []).filter(s => mySlotIds.has(s.id))
  const availableSlots = (slots || []).filter(s => !mySlotIds.has(s.id))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Walks</h1>

      {/* My Walks */}
      {mySlots.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">My Walks</h2>
          <div className="space-y-2">
            {mySlots.map((slot) => {
              const activeCount = (slot.slot_memberships as { status: string }[])
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
                        {new Date(slot.walk_date).toLocaleDateString('en-SG', {
                          weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
                        })}
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
          Available Walks
        </h2>
        {availableSlots.length === 0 && mySlots.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center shadow-sm">
            <p className="text-gray-500">No walks available at the moment.</p>
            <p className="text-sm text-gray-400 mt-1">Check back when a new survey round opens.</p>
          </div>
        ) : availableSlots.length === 0 ? (
          <div className="bg-white rounded-xl p-6 text-center shadow-sm">
            <p className="text-gray-500 text-sm">No more available walks in this round.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {availableSlots.map((slot) => {
              const activeCount = (slot.slot_memberships as { status: string }[])
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
                        {new Date(slot.walk_date).toLocaleDateString('en-SG', {
                          weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
                        })}
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
      </section>
    </div>
  )
}
