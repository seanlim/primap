'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { normalizePhone } from '@/lib/utils/phone'
import { normalizeBirthMonth } from '@/lib/utils/minor-status'

interface UpdateProfileInput {
  fullName: string
  phoneNumber: string
  birthMonth: string
}

interface UpdateProfileResult {
  success?: true
  error?: string
  fieldErrors?: {
    phoneNumber?: string
    birthMonth?: string
  }
}

export async function updateProfile(input: UpdateProfileInput): Promise<UpdateProfileResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const phone = normalizePhone(input.phoneNumber)
  if (!phone.ok) {
    return {
      error: phone.error,
      fieldErrors: { phoneNumber: phone.error },
    }
  }

  const birthMonth = input.birthMonth ? normalizeBirthMonth(input.birthMonth) : null
  if (input.birthMonth && !birthMonth) {
    const error = 'Enter a valid birth month and year.'
    return { error, fieldErrors: { birthMonth: error } }
  }
  const trimmedName = input.fullName.trim()
  const update = {
    full_name: trimmedName || null,
    phone_number: phone.e164,
    ...(birthMonth ? { birth_month: birthMonth } : {}),
  }
  const { error } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/profile')
  revalidatePath('/home')
  revalidatePath('/walk')
  return { success: true }
}
