'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendWalkCancellationEmail } from '@/lib/email'
import { getJoinBlockInfo, getWalkStartDateTime, hasWalkStarted } from '@/lib/utils/walk-participation'
import { OBSERVATION_MEDIA_BUCKET } from '@/lib/utils/storage'
import { DEFAULT_LATE_CANCEL_HOURS } from '@/lib/constants/settings'


export async function joinWalk(walkId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  interface JoinSlotQueryRow {
    walk_date: string
    start_time: string
    max_volunteers: number
    survey_rounds: { status?: string } | null
    slot_memberships: Array<{ user_id: string; status: string }>
  }

  const { data: slotRaw, error: slotError } = await supabase
    .from('walk_slots')
    .select(`
      walk_date,
      start_time,
      max_volunteers,
      survey_rounds (status),
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


const MAX_CANCELLATION_REASON_LENGTH = 1000

export async function cancelWalk(walkId: string, cancellationReason?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const warnings: string[] = []
  const sanitizedReason = cancellationReason?.trim() ?? ''

  const [{ data: slot, error: slotError }, { data: settings }] = await Promise.all([
    supabase
      .from('walk_slots')
      .select('walk_date, start_time, location_name')
      .eq('id', walkId)
      .single(),
    supabase
      .from('app_settings')
      .select('late_cancel_hours')
      .limit(1)
      .single(),
  ])

  if (slotError) return { error: slotError.message }
  if (!slot) return { error: 'Walk slot not found.' }

  const lateCancelHours = settings?.late_cancel_hours ?? DEFAULT_LATE_CANCEL_HOURS
  const slotStart = getWalkStartDateTime(slot.walk_date, slot.start_time)
  const lateCancelCutoff = new Date(slotStart.getTime() - lateCancelHours * 60 * 60 * 1000)
  const isLateCancellation =
    !Number.isNaN(slotStart.getTime()) && new Date() >= lateCancelCutoff

  if (isLateCancellation && sanitizedReason.length === 0) {
    return { error: 'Please provide a reason for this late cancellation.' }
  }

  if (sanitizedReason.length > MAX_CANCELLATION_REASON_LENGTH) {
    return { error: `Cancellation reason must be ${MAX_CANCELLATION_REASON_LENGTH} characters or fewer.` }
  }

  const { data, error } = await supabase.rpc('cancel_slot_with_draft_cleanup', {
    p_slot_id: walkId,
    p_cancellation_reason: isLateCancellation ? sanitizedReason : null,
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
    // 1. Get cancelling user info
    const { data: cancellingProfile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single()

    const cancellingName = cancellingProfile?.full_name || cancellingProfile?.email || 'A volunteer'

    // 2. Get other active members
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
    if (otherMembers.length > 0) {
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
