import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDate, getRelativeDay } from '@/lib/utils/format-date'
import { Calendar, PenLine, CheckCircle, MapPin, ArrowRight, Footprints, ClipboardList, ChevronRight } from 'lucide-react'
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
    <div className="space-y-6 animate-fade-in">
      {/* Gradient Welcome Banner */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-500 rounded-2xl p-6">
        <h1 className="text-2xl font-bold text-white">
          Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}
        </h1>
        <p className="text-white/80 mt-1">Here&apos;s your survey overview</p>
      </div>

      {/* Stat Cards with Icons */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-4 shadow-sm border-l-4 border-green-500">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{futureWalks.length}</p>
              <p className="text-xs text-gray-500">Upcoming</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border-l-4 border-yellow-500">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-yellow-50 rounded-lg flex items-center justify-center shrink-0">
              <PenLine className="w-4 h-4 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">{draftCount || 0}</p>
              <p className="text-xs text-gray-500">Drafts</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border-l-4 border-blue-500">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
              <CheckCircle className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{submittedCount || 0}</p>
              <p className="text-xs text-gray-500">Submitted</p>
            </div>
          </div>
        </div>
      </div>

      {/* Next Walk Card */}
      {futureWalks.length > 0 && (
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-green-800 mb-3">Next Walk</h2>
          {(() => {
            const slot = futureWalks[0].slot
            const relDay = getRelativeDay(slot.walk_date)
            return (
              <Link href={`/walk/${slot.id}`} className="flex items-center justify-between group">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-green-600 shrink-0" />
                    <p className="font-semibold text-gray-900">{slot.location_name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-green-500 shrink-0" />
                    <p className="text-sm text-gray-600">
                      {formatDate(slot.walk_date, 'short')} &middot; {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {relDay && (
                      <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">{relDay}</span>
                    )}
                    {slot.survey_rounds && (
                      <span className="text-xs text-green-600">{slot.survey_rounds.name}</span>
                    )}
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-green-400 group-hover:text-green-600 group-hover:translate-x-1 transition-all shrink-0" />
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
            className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md border border-transparent hover:border-green-200 transition-all text-center"
          >
            <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-2">
              <Footprints className="w-5 h-5 text-green-600" />
            </div>
            <p className="font-medium text-gray-900">Browse Walks</p>
            <p className="text-xs text-gray-500 mt-1">Find and join walks</p>
          </Link>
          <Link
            href="/report"
            className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md border border-transparent hover:border-green-200 transition-all text-center"
          >
            <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-2">
              <ClipboardList className="w-5 h-5 text-green-600" />
            </div>
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
              const relDay = getRelativeDay(slot.walk_date)
              return (
                <Link
                  key={membershipId}
                  href={`/walk/${slot.id}`}
                  className="flex items-center justify-between bg-white border-l-4 border-green-400 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all group"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                      <p className="font-medium text-gray-900">{slot.location_name}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      <p className="text-sm text-gray-500">
                        {formatDate(slot.walk_date, 'short')} &middot; {slot.start_time.slice(0, 5)}
                      </p>
                      {relDay && (
                        <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">{relDay}</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-green-500 transition-colors shrink-0" />
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {futureWalks.length === 0 && (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Footprints className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-gray-500">No upcoming walks</p>
          <Link href="/walk" className="text-green-600 font-medium text-sm hover:underline mt-2 inline-block">
            Browse available walks
          </Link>
        </div>
      )}
    </div>
  )
}
