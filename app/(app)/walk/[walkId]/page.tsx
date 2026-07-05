import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { WalkDetailClient } from './walk-detail-client'
import type { MembershipWithProfile } from '@/lib/types/supabase-helpers'
import { getJoinBlockInfo, getWalkStartDateTime } from '@/lib/utils/walk-participation'
import { isLateCancellationActive } from '@/lib/utils/reminder-schedule'

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
    .select('id, status')
    .eq('slot_id', walkId)
    .limit(1)

  const [{ data: walk }, { data: ownObservations }] = await Promise.all([
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
    ownObservationQuery,
  ])

  if (!walk) notFound()

  const round = walk.survey_rounds as unknown as { name: string; status: string }
  const memberships = (walk.slot_memberships as unknown as MembershipWithProfile[])
    .filter(m => m.status === 'ACTIVE')

  const userMembership = memberships.find(m => m.user_id === user.id)
  const hasSubmittedReport = (ownObservations || []).some((observation) => observation.status === 'SUBMITTED')
  const slotStart = getWalkStartDateTime(walk.walk_date, walk.start_time)
  const isPastOrStarted = slotStart <= new Date()
  const isFull = memberships.length >= walk.max_volunteers

  const joinBlockedInfo = !userMembership
    ? getJoinBlockInfo({
        roundStatus: round?.status,
        hasStarted: isPastOrStarted,
        isFull,
      })
    : null

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
        joinBlockedInfo,
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
      hasSubmittedReport={hasSubmittedReport}
    />
  )
}
