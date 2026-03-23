'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendWalkCancellationEmail } from '@/lib/email'

function getSlotStartDateTime(walkDate: string, startTime: string) {
  return new Date(`${walkDate}T${startTime}`)
}

export async function joinWalk(walkId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: slot, error: slotError } = await supabase
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
  if (!slot) return { error: 'Walk slot not found.' }

  const round = slot.survey_rounds as unknown as { status?: string } | null
  const memberships = (slot.slot_memberships as unknown as Array<{ user_id: string; status: string }>) || []
  const activeMemberships = memberships.filter((membership) => membership.status === 'ACTIVE')
  const alreadyJoined = activeMemberships.some((membership) => membership.user_id === user.id)

  if (round?.status !== 'OPEN') return { error: 'This walk is no longer open for signup.' }
  if (getSlotStartDateTime(slot.walk_date, slot.start_time) <= new Date()) {
    return { error: 'This walk has already started or passed.' }
  }
  if (alreadyJoined) return { error: 'You have already joined this walk.' }
  if (activeMemberships.length >= slot.max_volunteers) return { error: 'This walk slot is full.' }

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

  const submittedObservationQuery = supabase
    .from('observations')
    .select('id')
    .eq('slot_id', walkId)
    .eq('user_id', user.id)
    .eq('status', 'SUBMITTED')

  const submittedObservationResult = typeof (submittedObservationQuery as unknown as { maybeSingle?: unknown }).maybeSingle === 'function'
    ? await (submittedObservationQuery as unknown as {
        maybeSingle: () => Promise<{ data: { id: string } | null; error?: { code?: string; message: string } | null }>
      }).maybeSingle()
    : await (submittedObservationQuery as unknown as {
        single: () => Promise<{ data: { id: string } | null; error?: { code?: string; message: string } | null }>
      }).single()

  const submittedObservation = submittedObservationResult.data
  const submittedObservationError = submittedObservationResult.error

  if (submittedObservationError && submittedObservationError.code !== 'PGRST116') {
    return { error: submittedObservationError.message }
  }
  if (submittedObservation) {
    return { error: "You can't cancel this walk after submitting your report." }
  }

  const { data: cancelledMemberships, error } = await supabase
    .from('slot_memberships')
    .update({
      status: 'CANCELLED',
      cancelled_at: new Date().toISOString(),
    })
    .eq('slot_id', walkId)
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')
    .select('id')

  if (error) return { error: error.message }
  if (!cancelledMemberships || cancelledMemberships.length === 0) {
    return { error: 'You are not actively joined to this walk.' }
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
    const { data: otherMembers } = await supabase
      .from('slot_memberships')
      .select('user_id, profiles:user_id(email)')
      .eq('slot_id', walkId)
      .eq('status', 'ACTIVE')
      .neq('user_id', user.id)

    if (slot && otherMembers && otherMembers.length > 0) {
      const recipients = otherMembers
        .map(m => (m.profiles as unknown as { email: string })?.email)
        .filter(Boolean)

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
    // Return success with warning so UI can show a toast
    revalidatePath('/walk')
    revalidatePath(`/walk/${walkId}`)
    revalidatePath('/home')
    revalidatePath('/report')
    revalidatePath(`/report/${walkId}`)
    revalidatePath('/profile')
    return { success: true, warning: 'Cancelled successfully, but failed to notify other members.' }
  }

  revalidatePath('/walk')
  revalidatePath(`/walk/${walkId}`)
  revalidatePath('/home')
  revalidatePath('/report')
  revalidatePath(`/report/${walkId}`)
  revalidatePath('/profile')
  return { success: true }
}
