'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendWalkCancellationEmail } from '@/lib/email'

export async function joinWalk(walkId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

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
  return { success: true }
}


export async function cancelWalk(walkId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('slot_memberships')
    .update({
      status: 'CANCELLED',
      cancelled_at: new Date().toISOString(),
    })
    .eq('slot_id', walkId)
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')

  if (error) return { error: error.message }

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
    return { success: true, warning: 'Cancelled successfully, but failed to notify other members.' }
  }

  revalidatePath('/walk')
  revalidatePath(`/walk/${walkId}`)
  revalidatePath('/home')
  revalidatePath('/report')
  revalidatePath(`/report/${walkId}`)
  return { success: true }
}
