import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { isMinorAtRoundStart } from '@/lib/utils/minor-status'
import { RoundParticipantsClient } from './participants-client'

export const dynamic = 'force-dynamic'

export default async function RoundParticipantsPage({
  params,
}: {
  params: Promise<{ roundId: string }>
}) {
  const { roundId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: actor } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (actor?.role !== 'ADMIN') redirect('/home')

  const admin = createAdminClient()
  const { data: round } = await admin
    .from('survey_rounds')
    .select('id, name, start_date, minor_workshop_required')
    .eq('id', roundId)
    .maybeSingle()
  if (!round) notFound()

  const [{ data: slots, error: slotsError }, { data: roundRequirements, error: requirementsError }] = await Promise.all([
    admin
      .from('walk_slots')
      .select('id')
      .eq('round_id', roundId),
    admin
      .from('round_participation_requirements')
      .select('user_id, guardian_name, guardian_email, guardian_phone_number, guardian_accompaniment_acknowledged_at, guardian_workshop_attended_at')
      .eq('round_id', roundId),
  ])
  if (slotsError) throw new Error(slotsError.message)
  if (requirementsError) throw new Error(requirementsError.message)
  const slotIds = (slots ?? []).map(slot => slot.id)

  const membershipsResult = slotIds.length > 0
    ? await admin
        .from('slot_memberships')
        .select('user_id')
        .in('slot_id', slotIds)
        .eq('status', 'ACTIVE')
    : { data: [], error: null }
  if (membershipsResult.error) throw new Error(membershipsResult.error.message)

  const userIds = [...new Set([
    ...(membershipsResult.data ?? []).map(row => row.user_id),
    ...(roundRequirements ?? []).map(row => row.user_id),
  ])]
  const profilesResult = userIds.length > 0
    ? await admin
        .from('profiles')
        .select('id, full_name, email, birth_month')
        .in('id', userIds)
    : { data: [], error: null }

  if (profilesResult.error) throw new Error(profilesResult.error.message)

  const requirementsByUserId = new Map(
    (roundRequirements ?? []).map(requirement => [requirement.user_id, requirement])
  )
  const participants = (profilesResult.data ?? [])
    .filter(profile => isMinorAtRoundStart(profile.birth_month, round.start_date))
    .map(profile => {
      const requirement = requirementsByUserId.get(profile.id)
      return {
        userId: profile.id,
        name: profile.full_name || profile.email,
        email: profile.email,
        guardianName: requirement?.guardian_name ?? '',
        guardianEmail: requirement?.guardian_email ?? '',
        guardianPhone: requirement?.guardian_phone_number ?? '',
        accompanimentAcknowledged: Boolean(requirement?.guardian_accompaniment_acknowledged_at),
        workshopAttendedAt: requirement?.guardian_workshop_attended_at ?? null,
      }
    })
    .sort((left, right) => left.name.localeCompare(right.name))

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link href="/admin/rounds" className="text-sm text-green-700 hover:underline">← Back to rounds</Link>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{round.name} · Participants</h1>
        <p className="mt-1 text-sm text-gray-500">
          Minor volunteers and their round-specific guardian details. Guardian contact information is admin-only.
        </p>
        <p className="mt-2 text-sm font-medium text-amber-800">
          {round.minor_workshop_required
            ? 'Workshop required: mark attendance after the guardian attends.'
            : 'Workshop not required for this round.'}
        </p>
      </div>
      <RoundParticipantsClient
        roundId={round.id}
        workshopRequired={round.minor_workshop_required}
        participants={participants}
      />
    </div>
  )
}
