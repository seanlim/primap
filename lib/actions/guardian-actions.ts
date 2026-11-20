'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/utils/phone'
import { isMinorAtRoundStart } from '@/lib/utils/minor-status'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface GuardianDetailsInput {
  guardianName: string
  guardianEmail: string
  guardianPhone: string
  confirmsAccompaniment: boolean
}

export async function saveRoundGuardianDetails(roundId: string, input: GuardianDetailsInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (!roundId) return { error: 'Survey round is required.' }

  const [{ data: profile }, admin] = await Promise.all([
    supabase
      .from('profiles')
      .select('role, birth_month')
      .eq('id', user.id)
      .single(),
    Promise.resolve(createAdminClient()),
  ])

  if (profile?.role !== 'VOLUNTEER') return { error: 'Guardian details are only for volunteers.' }
  if (!profile.birth_month) {
    return { error: 'Add your birth month and year to your profile first.', code: 'BIRTH_MONTH_REQUIRED' as const }
  }

  const { data: round } = await admin
    .from('survey_rounds')
    .select('id, start_date')
    .eq('id', roundId)
    .maybeSingle()
  if (!round) return { error: 'Survey round not found.' }
  if (!isMinorAtRoundStart(profile.birth_month, round.start_date)) {
    return { error: 'Guardian details are not required for this survey round.' }
  }

  const guardianName = input.guardianName.trim()
  const guardianEmail = input.guardianEmail.trim().toLowerCase()
  if (!guardianName) return { error: 'Enter your guardian’s name.' }
  if (!EMAIL_PATTERN.test(guardianEmail)) return { error: 'Enter a valid guardian email address.' }
  if (!input.confirmsAccompaniment) {
    return { error: 'Confirm that this guardian will accompany you on walks in this round.' }
  }

  const rawPhone = input.guardianPhone.trim()
  const guardianPhone = rawPhone ? normalizePhone(rawPhone) : null
  if (guardianPhone && !guardianPhone.ok) return { error: guardianPhone.error }

  const { data: previous } = await admin
    .from('round_participation_requirements')
    .select('guardian_name, guardian_email, guardian_phone_number, guardian_email_verified_at, guardian_phone_verified_at, guardian_workshop_attended_at')
    .eq('user_id', user.id)
    .eq('round_id', roundId)
    .maybeSingle()

  const normalizedPhone = guardianPhone?.ok ? guardianPhone.e164 : null
  const guardianChanged = Boolean(previous && (
    previous.guardian_name !== guardianName
    || previous.guardian_email !== guardianEmail
    || previous.guardian_phone_number !== normalizedPhone
  ))

  const { error } = await admin
    .from('round_participation_requirements')
    .upsert({
      user_id: user.id,
      round_id: roundId,
      guardian_name: guardianName,
      guardian_email: guardianEmail,
      guardian_phone_number: normalizedPhone,
      guardian_email_verified_at: previous?.guardian_email === guardianEmail
        ? previous.guardian_email_verified_at
        : null,
      guardian_phone_verified_at: previous?.guardian_phone_number === normalizedPhone
        ? previous.guardian_phone_verified_at
        : null,
      guardian_accompaniment_acknowledged_at: new Date().toISOString(),
      guardian_workshop_attended_at: guardianChanged
        ? null
        : previous?.guardian_workshop_attended_at ?? null,
    }, { onConflict: 'user_id,round_id' })

  if (error) return { error: error.message }

  revalidatePath('/walk')
  revalidatePath('/admin/rounds')
  revalidatePath(`/admin/rounds/${roundId}/participants`)
  return { success: true as const }
}

export async function markGuardianWorkshopAttendance(
  roundId: string,
  userId: string,
  attended: boolean
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: actor } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (actor?.role !== 'ADMIN') return { error: 'Not authorized' }
  if (!roundId || !userId) return { error: 'Round and volunteer are required.' }

  const admin = createAdminClient()
  const [{ data: round }, { data: profile }, { data: requirement }] = await Promise.all([
    admin
      .from('survey_rounds')
      .select('id, start_date, minor_workshop_required')
      .eq('id', roundId)
      .maybeSingle(),
    admin
      .from('profiles')
      .select('birth_month, role')
      .eq('id', userId)
      .maybeSingle(),
    admin
      .from('round_participation_requirements')
      .select('guardian_name, guardian_email, guardian_workshop_attended_at')
      .eq('round_id', roundId)
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  if (!round) return { error: 'Survey round not found.' }
  if (!round.minor_workshop_required) return { error: 'This round does not require a workshop.' }
  if (profile?.role !== 'VOLUNTEER' || !isMinorAtRoundStart(profile.birth_month, round.start_date)) {
    return { error: 'Workshop attendance only applies to minor volunteers.' }
  }
  if (!requirement?.guardian_name || !requirement.guardian_email) {
    return { error: 'Guardian details must be saved before workshop attendance can be recorded.' }
  }

  const { error } = await admin
    .from('round_participation_requirements')
    .update({ guardian_workshop_attended_at: attended ? new Date().toISOString() : null })
    .eq('round_id', roundId)
    .eq('user_id', userId)

  if (error) return { error: error.message }
  revalidatePath(`/admin/rounds/${roundId}/participants`)
  revalidatePath('/walk')
  return { success: true as const }
}

export async function updateGuardianDetailsAsAdmin(
  roundId: string,
  userId: string,
  input: Pick<GuardianDetailsInput, 'guardianName' | 'guardianEmail' | 'guardianPhone'>
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: actor } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (actor?.role !== 'ADMIN') return { error: 'Not authorized' }
  if (!roundId || !userId) return { error: 'Round and volunteer are required.' }

  const guardianName = input.guardianName.trim()
  const guardianEmail = input.guardianEmail.trim().toLowerCase()
  if (!guardianName) return { error: 'Enter the guardian’s name.' }
  if (!EMAIL_PATTERN.test(guardianEmail)) return { error: 'Enter a valid guardian email address.' }
  const rawPhone = input.guardianPhone.trim()
  const guardianPhone = rawPhone ? normalizePhone(rawPhone) : null
  if (guardianPhone && !guardianPhone.ok) return { error: guardianPhone.error }

  const admin = createAdminClient()
  const [{ data: round }, { data: profile }, { data: previous }] = await Promise.all([
    admin
      .from('survey_rounds')
      .select('id, start_date')
      .eq('id', roundId)
      .maybeSingle(),
    admin
      .from('profiles')
      .select('birth_month, role')
      .eq('id', userId)
      .maybeSingle(),
    admin
      .from('round_participation_requirements')
      .select('guardian_name, guardian_email, guardian_phone_number, guardian_email_verified_at, guardian_phone_verified_at, guardian_workshop_attended_at, guardian_accompaniment_acknowledged_at')
      .eq('round_id', roundId)
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  if (!round || profile?.role !== 'VOLUNTEER'
    || !isMinorAtRoundStart(profile.birth_month, round.start_date)) {
    return { error: 'Guardian details only apply to minor volunteers in this round.' }
  }

  const normalizedPhone = guardianPhone?.ok ? guardianPhone.e164 : null
  const changed = Boolean(previous && (
    previous.guardian_name !== guardianName
    || previous.guardian_email !== guardianEmail
    || previous.guardian_phone_number !== normalizedPhone
  ))
  const { error } = await admin
    .from('round_participation_requirements')
    .upsert({
      user_id: userId,
      round_id: roundId,
      guardian_name: guardianName,
      guardian_email: guardianEmail,
      guardian_phone_number: normalizedPhone,
      guardian_email_verified_at: previous?.guardian_email === guardianEmail
        ? previous.guardian_email_verified_at
        : null,
      guardian_phone_verified_at: previous?.guardian_phone_number === normalizedPhone
        ? previous.guardian_phone_verified_at
        : null,
      guardian_workshop_attended_at: changed ? null : previous?.guardian_workshop_attended_at ?? null,
      guardian_accompaniment_acknowledged_at: previous?.guardian_accompaniment_acknowledged_at ?? null,
    }, { onConflict: 'user_id,round_id' })

  if (error) return { error: error.message }
  revalidatePath(`/admin/rounds/${roundId}/participants`)
  revalidatePath('/walk')
  return { success: true as const }
}
