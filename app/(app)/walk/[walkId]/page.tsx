import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { WalkDetailClient } from './walk-detail-client'
import type { MembershipWithProfile } from '@/lib/types/supabase-helpers'

export const dynamic = 'force-dynamic'

export default async function WalkDetailPage({
  params,
}: {
  params: Promise<{ walkId: string }>
}) {
  const { walkId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const ownObservationQuery = supabase
    .from('observations')
    .select('status')
    .eq('slot_id', walkId)
    .eq('user_id', user.id)

  const ownObservationPromise = typeof (ownObservationQuery as unknown as { maybeSingle?: unknown }).maybeSingle === 'function'
    ? (ownObservationQuery as unknown as { maybeSingle: () => Promise<{ data: { status: string } | null }> }).maybeSingle()
    : ownObservationQuery.single()

  const [{ data: walk }, { data: settings }, { data: ownObservation }] = await Promise.all([
    supabase
      .from('walk_slots')
      .select(`
        *,
        survey_rounds (name, status),
        slot_memberships (
          id,
          user_id,
          status,
          joined_at,
          profiles:user_id (full_name, email, avatar_url)
        )
      `)
      .eq('id', walkId)
      .single(),
    supabase
      .from('app_settings')
      .select('late_cancel_hours')
      .limit(1)
      .single(),
    ownObservationPromise,
  ])

  if (!walk) notFound()

  const round = walk.survey_rounds as unknown as { name: string; status: string }
  const memberships = (walk.slot_memberships as unknown as MembershipWithProfile[])
    .filter(m => m.status === 'ACTIVE')

  const userMembership = memberships.find(m => m.user_id === user.id)
  const slotStart = new Date(`${walk.walk_date}T${walk.start_time}`)
  const isPastOrStarted = slotStart <= new Date()
  const isRoundOpen = round?.status === 'OPEN'
  const isFull = memberships.length >= walk.max_volunteers
  const lateCancelHours = settings?.late_cancel_hours || 48
  const lateCancelCutoff = new Date(slotStart.getTime() - lateCancelHours * 60 * 60 * 1000)
  const lateCancelWarning = userMembership && new Date() >= lateCancelCutoff
    ? `This walk starts within the ${lateCancelHours}-hour late cancellation window.`
    : null
  const hasSubmittedReport = ownObservation?.status === 'SUBMITTED'

  let joinBlockedReason: string | null = null
  if (!userMembership) {
    if (!isRoundOpen) joinBlockedReason = 'This walk is no longer open for signup.'
    else if (isPastOrStarted) joinBlockedReason = 'This walk has already started or passed.'
    else if (isFull) joinBlockedReason = 'Walk Full'
  }

  return (
    <WalkDetailClient
      walk={{
        id: walk.id,
        locationName: walk.location_name,
        walkDate: walk.walk_date,
        startTime: walk.start_time,
        endTime: walk.end_time,
        maxVolunteers: walk.max_volunteers,
        notes: null,
        roundName: round?.name || '',
        joinBlockedReason,
      }}
      members={memberships.map(m => ({
        userId: m.user_id,
        fullName: m.profiles?.full_name || null,
        email: m.profiles?.email || '',
        joinedAt: m.joined_at,
      }))}
      isJoined={!!userMembership}
      isFull={isFull}
      currentUserId={user.id}
      lateCancelWarning={lateCancelWarning}
      hasSubmittedReport={hasSubmittedReport}
    />
  )
}
