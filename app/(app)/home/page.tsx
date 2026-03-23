import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDate } from '@/lib/utils/format-date'
import type { WalkRef } from '@/lib/types/supabase-helpers'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = new Date()
  const today = now.toISOString().split('T')[0]

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Get upcoming walks: start from walk_slots with !inner join to only get future walks
  const { data: upcomingWalks } = await supabase
    .from('slot_memberships')
    .select(`
      id,
      status,
      walk_slots!inner (
        id,
        location_name,
        walk_date,
        start_time,
        end_time,
        survey_rounds (name)
      )
    `)
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')
    .gte('walk_slots.walk_date', today)

  const upcomingMemberships = upcomingWalks || []
  const activeSlotIds = upcomingMemberships
    .map((membership) => (membership.walk_slots as unknown as WalkRef)?.id)
    .filter(Boolean)

  const { count: draftCount } = activeSlotIds.length > 0
    ? await supabase
        .from('observations')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'DRAFT')
        .in('slot_id', activeSlotIds)
    : { count: 0 }

  // Count submitted reports
  const { count: submittedCount } = await supabase
    .from('observations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'SUBMITTED')

  const futureWalks = upcomingMemberships
    .map((membership) => {
      const slot = membership.walk_slots as unknown as WalkRef
      return slot ? { membershipId: membership.id, slot } : null
    })
    .filter(Boolean)
    .sort((a, b) => {
      const aTime = new Date(`${a!.slot.walk_date}T${a!.slot.start_time}`).getTime()
      const bTime = new Date(`${b!.slot.walk_date}T${b!.slot.start_time}`).getTime()
      return aTime - bTime
    })
    .slice(0, 5) as Array<{ membershipId: string; slot: WalkRef }>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}
        </h1>
        <p className="text-gray-500 mt-1">Here&apos;s your survey overview</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-green-600">{futureWalks.length}</p>
          <p className="text-xs text-gray-500 mt-1">Upcoming</p>
        </div>
        <div className="bg-white rounded-xl p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-yellow-600">{draftCount || 0}</p>
          <p className="text-xs text-gray-500 mt-1">Drafts</p>
        </div>
        <div className="bg-white rounded-xl p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-blue-600">{submittedCount || 0}</p>
          <p className="text-xs text-gray-500 mt-1">Submitted</p>
        </div>
      </div>

      {/* Next Walk Card */}
      {futureWalks.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-green-800 mb-3">Next Walk</h2>
          {(() => {
            const slot = futureWalks[0].slot
            return (
              <Link href={`/walk/${slot.id}`} className="block">
                <p className="font-semibold text-gray-900">{slot.location_name}</p>
                <p className="text-sm text-gray-600 mt-1">
                  {formatDate(slot.walk_date, 'short')} &middot; {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                </p>
                {slot.survey_rounds && (
                  <p className="text-xs text-green-600 mt-1">{slot.survey_rounds.name}</p>
                )}
              </Link>
            )
          })()}
        </div>
      )}

      {/* Quick Actions */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/walk"
            className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow text-center"
          >
            <p className="font-medium text-gray-900">Browse Walks</p>
            <p className="text-xs text-gray-500 mt-1">Find and join walks</p>
          </Link>
          <Link
            href="/report"
            className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow text-center"
          >
            <p className="font-medium text-gray-900">My Reports</p>
            <p className="text-xs text-gray-500 mt-1">View and submit reports</p>
          </Link>
        </div>
      </div>

      {/* Upcoming Walks List */}
      {futureWalks.length > 1 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Upcoming Walks</h2>
          <div className="space-y-2">
            {futureWalks.slice(1).map(({ membershipId, slot }) => {
              return (
                <Link
                  key={membershipId}
                  href={`/walk/${slot.id}`}
                  className="block bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  <p className="font-medium text-gray-900">{slot.location_name}</p>
                  <p className="text-sm text-gray-500">
                    {formatDate(slot.walk_date, 'short')} &middot; {slot.start_time.slice(0, 5)}
                  </p>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {futureWalks.length === 0 && (
        <div className="bg-white rounded-xl p-8 text-center shadow-sm">
          <p className="text-gray-500">No upcoming walks</p>
          <Link href="/walk" className="text-green-600 font-medium text-sm hover:underline mt-2 inline-block">
            Browse available walks
          </Link>
        </div>
      )}
    </div>
  )
}
