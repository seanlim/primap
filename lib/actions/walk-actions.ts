'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { sendWalkCancellationEmail } from '@/lib/email'
import { getJoinBlockInfo, hasWalkStarted } from '@/lib/utils/walk-participation'
import { OBSERVATION_MEDIA_BUCKET } from '@/lib/utils/storage'
import { isProfileContactComplete } from '@/lib/auth/contact-profile'
import { getRoundRequirementStatus } from '@/lib/auth/round-requirements'


export async function joinWalk(walkId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  interface JoinSlotQueryRow {
    round_id: string
    walk_date: string
    start_time: string
    max_volunteers: number
    survey_rounds: {
      id: string
      status?: string
      start_date: string
      end_date: string
      indemnity_form_url: string | null
    } | null
    slot_memberships: Array<{ user_id: string; status: string }>
  }

  const { data: slotRaw, error: slotError } = await supabase
    .from('walk_slots')
    .select(`
      walk_date,
      start_time,
      max_volunteers,
      round_id,
      survey_rounds (id, status, start_date, end_date, indemnity_form_url),
      slot_memberships (user_id, status)
    `)
    .eq('id', walkId)
    .single()

  if (slotError) return { error: slotError.message }
  if (!slotRaw) return { error: 'Walk slot not found.' }

  const slot = slotRaw as unknown as JoinSlotQueryRow
  const round = slot.survey_rounds
  const memberships = slot.slot_memberships || []
  const activeMemberships = memberships.filter((membership) => membership.status === 'ACTIVE')
  const alreadyJoined = activeMemberships.some((membership) => membership.user_id === user.id)
  const joinBlock = getJoinBlockInfo({
    roundStatus: round?.status,
    hasStarted: hasWalkStarted(slot.walk_date, slot.start_time),
    isFull: activeMemberships.length >= slot.max_volunteers,
  })

  if (joinBlock?.label === 'Round Closed') return { error: joinBlock.description }
  if (joinBlock?.label === 'Walk Started') return { error: joinBlock.description }
  if (alreadyJoined) return { error: 'You have already joined this walk.' }
  if (joinBlock?.label === 'Walk Full') return { error: joinBlock.description }

  if (!round) return { error: 'Round not found.' }

  const admin = createAdminClient()
  const [{ data: profile, error: profileError }, { data: requirement, error: requirementError }] = await Promise.all([
    admin
      .from('profiles')
      .select('phone_number, phone_verified_at, birth_month')
      .eq('id', user.id)
      .single(),
    admin
      .from('round_participation_requirements')
      .select('indemnity_acknowledged_at, guardian_name, guardian_email, guardian_email_verified_at, guardian_phone_number, guardian_phone_verified_at')
      .eq('user_id', user.id)
      .eq('round_id', round.id || slot.round_id)
      .maybeSingle(),
  ])

  if (profileError) return { error: profileError.message }
  if (!profile || !isProfileContactComplete(profile)) {
    return { error: 'Complete your profile before joining a walk.' }
  }
  if (requirementError) return { error: requirementError.message }

  const requirementStatus = getRoundRequirementStatus(profile, round, requirement ?? null)
  if (!requirementStatus.complete) {
    return { error: 'Complete the round requirements before joining this walk.' }
  }

  // The RPC remains the atomic source of truth for membership + draft-observation
  // creation/reactivation. These prechecks only keep the volunteer UX and server
  // action aligned before we hand off to the database boundary.
  const { data, error } = await supabase.rpc('join_slot_with_observation', {
    p_slot_id: walkId,
    p_user_id: user.id,
  })

  if (error) return { error: error.message }

  const result = data as { success?: boolean; error?: string }
  if (result.error) return { error: result.error }

  revalidatePath('/walk')
  revalidatePath(`/walk/${walkId}`)
  revalidatePath('/home')
  revalidatePath('/report')
  revalidatePath(`/report/${walkId}`)
  revalidatePath('/profile')
  return { success: true }
}


export async function cancelWalk(walkId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const warnings: string[] = []

  const { data, error } = await supabase.rpc('cancel_slot_with_draft_cleanup', {
    p_slot_id: walkId,
  })

  if (error) return { error: error.message }

  const result = data as {
    success?: boolean
    error?: string
    deleted_draft_count?: number
    file_paths?: string[]
  } | null
  if (!result || typeof result !== 'object') {
    return { error: 'Unexpected cancellation response.' }
  }
  if (result.error) return { error: result.error }
  if (result.success !== true) return { error: 'Unexpected cancellation response.' }

  const filePaths = Array.isArray(result.file_paths)
    ? result.file_paths.filter((path): path is string => typeof path === 'string' && path.length > 0)
    : []

  if (filePaths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from(OBSERVATION_MEDIA_BUCKET)
      .remove(filePaths)

    if (storageError) {
      console.error('Error deleting draft observation media after cancellation:', storageError)
      warnings.push('Cancelled successfully, but failed to remove your draft report media.')
    }
  }

  // Notify other members
  try {
    // 1. Get walk info
    const { data: slot } = await supabase
      .from('walk_slots')
      .select('walk_date, start_time, location_name')
      .eq('id', walkId)
      .single()

    // 2. Get cancelling user info
    const { data: cancellingProfile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single()

    const cancellingName = cancellingProfile?.full_name || cancellingProfile?.email || 'A volunteer'

    // 3. Get other active members
    interface MembershipRow {
      user_id: string
      profiles: { email: string } | null
    }

    const { data: otherMembersRaw } = await supabase
      .from('slot_memberships')
      .select('user_id, profiles:user_id(email)')
      .eq('slot_id', walkId)
      .eq('status', 'ACTIVE')
      .neq('user_id', user.id)

    const otherMembers = (otherMembersRaw || []) as unknown as MembershipRow[]
    if (slot && otherMembers.length > 0) {
      const recipients = otherMembers
        .map(m => m.profiles?.email)
        .filter((e): e is string => Boolean(e))

      if (recipients.length > 0) {
        await sendWalkCancellationEmail(
          recipients,
          {
            date: slot.walk_date,
            time: slot.start_time,
            location: slot.location_name
          },
          cancellingName
        )
      }
    }
  } catch (err) {
    console.error('Error sending cancellation emails:', err)
    warnings.push('Cancelled successfully, but failed to notify other members.')
  }

  revalidatePath('/walk')
  revalidatePath(`/walk/${walkId}`)
  revalidatePath('/home')
  revalidatePath('/report')
  revalidatePath(`/report/${walkId}`)
  revalidatePath('/admin/reports')
  revalidatePath(`/admin/reports/${walkId}`)
  revalidatePath('/profile')
  return warnings.length > 0
    ? { success: true, warning: warnings.join(' ') }
    : { success: true }
}
