'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendSlotCancellationEmail } from '@/lib/email'

export async function joinSlot(slotId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('slot_memberships')
    .insert({
      slot_id: slotId,
      user_id: user.id,
      status: 'ACTIVE',
    })

  if (error) {
    if (error.message.includes('Slot is full')) {
      return { error: 'This walk slot is full.' }
    }
    if (error.code === '23505') {
      return { error: 'You have already joined this walk.' }
    }
    return { error: error.message }
  }

  // Auto-create a DRAFT observation for the user
  await supabase.from('observations').insert({
    slot_id: slotId,
    user_id: user.id,
    status: 'DRAFT',
  })

  revalidatePath('/walk')
  revalidatePath(`/walk/${slotId}`)
  revalidatePath('/home')
  revalidatePath('/report')
  revalidatePath(`/report/${slotId}`)
  return { success: true }
}


export async function cancelSlot(slotId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('slot_memberships')
    .update({
      status: 'CANCELLED',
      cancelled_at: new Date().toISOString(),
    })
    .eq('slot_id', slotId)
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')

  if (error) return { error: error.message }

  // Notify other members
  try {
    // 1. Get slot info
    const { data: slot } = await supabase
      .from('walk_slots')
      .select('walk_date, start_time, location_name')
      .eq('id', slotId)
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
      .eq('slot_id', slotId)
      .eq('status', 'ACTIVE')
      .neq('user_id', user.id)

    if (slot && otherMembers && otherMembers.length > 0) {
      const recipients = otherMembers
        .map(m => (m.profiles as unknown as { email: string })?.email)
        .filter(Boolean)
      
      if (recipients.length > 0) {
        await sendSlotCancellationEmail(
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
    // Don't fail the action if email fails
  }

  revalidatePath('/walk')
  revalidatePath(`/walk/${slotId}`)
  revalidatePath('/home')
  return { success: true }
}
