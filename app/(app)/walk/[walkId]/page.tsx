import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import { WalkDetailClient } from './walk-detail-client'
import { getJoinBlockInfo, getWalkStartDateTime } from '@/lib/utils/walk-participation'
import { getRoundRequirementStatus } from '@/lib/auth/round-requirements'
import type { RoundRequirementViewModel } from './round-requirements-panel'

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
    .eq('user_id', user.id)
    .limit(2)

  const [{ data: walk }, { data: settings }, { data: ownObservations }] = await Promise.all([
    supabase
      .from('walk_slots')
      .select(`
        *,
        survey_rounds (id, name, status, start_date, end_date, indemnity_form_url),
        slot_memberships (
          id,
          user_id,
          status,
          joined_at,
          profiles:user_id (full_name, email, avatar_url, phone_number, phone_verified_at)
        )
      `)
      .eq('id', walkId)
      .single(),
    supabase
      .from('app_settings')
      .select('late_cancel_hours')
      .limit(1)
      .single(),
    ownObservationQuery,
  ])

  if (!walk) notFound()

  interface WalkRoundRef {
    id: string
    name: string
    status: string
    start_date: string
    end_date: string
    indemnity_form_url: string | null
  }

  interface MembershipWithContactProfile {
    id: string
    user_id: string
    status: string
    joined_at: string
    profiles: {
      full_name: string | null
      email: string
      avatar_url: string | null
      phone_number: string | null
      phone_verified_at: string | null
    } | null
  }

  const round = walk.survey_rounds as unknown as WalkRoundRef
  const memberships = (walk.slot_memberships as unknown as MembershipWithContactProfile[])
    .filter(m => m.status === 'ACTIVE')

  const userMembership = memberships.find(m => m.user_id === user.id)
  const observationRows = ownObservations || []
  if (observationRows.length > 1) {
    console.error('Expected at most one observation per user per walk slot.', {
      walkId,
      userId: user.id,
      observationIds: observationRows.map((observation) => observation.id),
    })
  }
  const hasSubmittedReport = observationRows.some((observation) => observation.status === 'SUBMITTED')
  const slotStart = getWalkStartDateTime(walk.walk_date, walk.start_time)
  const isPastOrStarted = slotStart <= new Date()
  const isFull = memberships.length >= walk.max_volunteers
  const lateCancelHours = settings?.late_cancel_hours || 48
  const lateCancelCutoff = new Date(slotStart.getTime() - lateCancelHours * 60 * 60 * 1000)
  const lateCancelWarning = userMembership && new Date() >= lateCancelCutoff
    ? `This walk starts within the ${lateCancelHours}-hour late cancellation window.`
    : null

  const joinBlockedInfo = !userMembership
    ? getJoinBlockInfo({
        roundStatus: round?.status,
        hasStarted: isPastOrStarted,
        isFull,
      })
    : null

  const admin = createAdminClient()
  const [{ data: contactProfile }, { data: requirement }] = await Promise.all([
    admin
      .from('profiles')
      .select('birth_month')
      .eq('id', user.id)
      .single(),
    admin
      .from('round_participation_requirements')
      .select('indemnity_acknowledged_at, guardian_name, guardian_email, guardian_email_verified_at, guardian_phone_number, guardian_phone_verified_at')
      .eq('user_id', user.id)
      .eq('round_id', round.id)
      .maybeSingle(),
  ])

  const requirementStatus = getRoundRequirementStatus(
    { birth_month: contactProfile?.birth_month ?? null },
    round,
    requirement ?? null
  )

  const roundRequirement: RoundRequirementViewModel = {
    roundId: round.id,
    formUrl: round.indemnity_form_url,
    requiresGuardian: requirementStatus.requiresGuardian,
    complete: requirementStatus.complete,
    missingFields: requirementStatus.missingFields,
    indemnityAcknowledgedAt: requirement?.indemnity_acknowledged_at ?? null,
    guardianName: requirement?.guardian_name ?? null,
    guardianEmail: requirement?.guardian_email ?? null,
    guardianEmailVerifiedAt: requirement?.guardian_email_verified_at ?? null,
    guardianPhoneNumber: requirement?.guardian_phone_number ?? null,
    guardianPhoneVerifiedAt: requirement?.guardian_phone_verified_at ?? null,
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
        joinBlockedInfo,
      }}
      members={memberships.map(m => ({
        userId: m.user_id,
        fullName: m.profiles?.full_name || null,
        email: m.profiles?.email || '',
        phoneNumber: userMembership && m.profiles?.phone_verified_at
          ? m.profiles.phone_number
          : null,
        joinedAt: m.joined_at,
      }))}
      roundRequirement={roundRequirement}
      isJoined={!!userMembership}
      isFull={isFull}
      currentUserId={user.id}
      lateCancelWarning={lateCancelWarning}
      hasSubmittedReport={hasSubmittedReport}
    />
  )
}
