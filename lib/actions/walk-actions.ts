'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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

  revalidatePath('/walk')
  revalidatePath(`/walk/${slotId}`)
  revalidatePath('/home')
  return { success: true }
}
