'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  type ContactDetailsInput,
  normalizePhoneNumber,
  validateContactDetails,
} from '@/lib/auth/contact-profile'

interface ActionResult {
  success?: true
  error?: string
  phoneNumber?: string
  alreadyVerified?: boolean
}

function revalidateContactPaths() {
  revalidatePath('/complete-profile')
  revalidatePath('/profile')
  revalidatePath('/home')
  revalidatePath('/admin/users')
}

function normalizeOtpToken(token: string): string | null {
  const trimmed = token.trim()
  return /^\d{6}$/.test(trimmed) ? trimmed : null
}

function hasPendingPhoneChange(user: unknown): boolean {
  return Boolean(getPendingPhoneChange(user))
}

function getPendingPhoneChange(user: unknown): string | null {
  if (!user || typeof user !== 'object') return null
  const pendingPhone = user as { new_phone?: unknown; phone_change?: unknown }
  const phone = [pendingPhone.new_phone, pendingPhone.phone_change].find(
    (value) => typeof value === 'string' && value.length > 0
  )
  return typeof phone === 'string' ? phone : null
}

function phoneDigits(value: string | null | undefined): string {
  return value?.replace(/\D/g, '') ?? ''
}

function hasPendingPhoneChangeForPhone(user: unknown, phone: string): boolean {
  const pendingPhone = getPendingPhoneChange(user)
  return Boolean(pendingPhone && phoneDigits(pendingPhone) === phoneDigits(phone))
}

function getConfirmedAuthPhoneAt(
  user: { phone?: string | null; phone_confirmed_at?: string | null } | null | undefined,
  phone: string
): string | null {
  if (!user?.phone_confirmed_at) return null
  return phoneDigits(user.phone) === phoneDigits(phone) ? user.phone_confirmed_at : null
}

function formatSmsProviderError(message: string): string {
  const normalized = message.toLowerCase()
  if (normalized.includes('sms') || normalized.includes('provider')) {
    return 'Unable to send SMS provider. Check Supabase Auth SMS settings.'
  }
  return message
}

async function getAuthenticatedUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const }
  return { supabase, user }
}

export async function saveContactDetails(input: ContactDetailsInput): Promise<ActionResult> {
  const auth = await getAuthenticatedUser()
  if ('error' in auth) return { error: auth.error }

  const validated = validateContactDetails(input)
  if (validated.error) return { error: validated.error }
  const contact = validated.value
  if (!contact) return { error: 'Invalid contact details' }

  const { data: currentProfile, error: fetchError } = await auth.supabase
    .from('profiles')
    .select('phone_number, phone_verified_at')
    .eq('id', auth.user.id)
    .single()

  if (fetchError) return { error: fetchError.message }

  const currentPhoneStillVerified = currentProfile?.phone_number === contact.phoneNumber
  const { error } = await auth.supabase
    .from('profiles')
    .update({
      full_name: contact.fullName,
      phone_number: contact.phoneNumber,
      phone_verified_at: currentPhoneStillVerified ? currentProfile.phone_verified_at : null,
      birth_month: contact.birthMonth,
      updated_at: new Date().toISOString(),
    })
    .eq('id', auth.user.id)

  if (error) return { error: error.message }

  revalidateContactPaths()
  return { success: true, phoneNumber: contact.phoneNumber }
}

export async function sendAccountPhoneOtp(phoneNumber: string): Promise<ActionResult> {
  const auth = await getAuthenticatedUser()
  if ('error' in auth) return { error: auth.error }

  const normalized = normalizePhoneNumber(phoneNumber)
  if (normalized.error) return { error: normalized.error }
  const phone = normalized.value
  if (!phone) return { error: 'Invalid phone number.' }

  const existingConfirmedAt = getConfirmedAuthPhoneAt(auth.user, phone)
  if (existingConfirmedAt) {
    const { error: profileError } = await auth.supabase
      .from('profiles')
      .update({
        phone_number: phone,
        phone_verified_at: existingConfirmedAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', auth.user.id)

    if (profileError) return { error: profileError.message }

    revalidateContactPaths()
    return { success: true, phoneNumber: phone, alreadyVerified: true }
  }

  if (hasPendingPhoneChangeForPhone(auth.user, phone)) {
    const { error: resendError } = await auth.supabase.auth.resend({
      type: 'phone_change',
      phone,
    })

    if (resendError) return { error: formatSmsProviderError(resendError.message) }

    const { error: profileError } = await auth.supabase
      .from('profiles')
      .update({
        phone_number: phone,
        phone_verified_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', auth.user.id)

    if (profileError) return { error: profileError.message }

    revalidateContactPaths()
    return { success: true, phoneNumber: phone }
  }

  const { data: authData, error: authError } = await auth.supabase.auth.updateUser({
    phone,
  })

  if (authError) return { error: formatSmsProviderError(authError.message) }

  const updatedConfirmedAt = getConfirmedAuthPhoneAt(authData.user, phone)
  if (updatedConfirmedAt) {
    const { error: profileError } = await auth.supabase
      .from('profiles')
      .update({
        phone_number: phone,
        phone_verified_at: updatedConfirmedAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', auth.user.id)

    if (profileError) return { error: profileError.message }

    revalidateContactPaths()
    return { success: true, phoneNumber: phone, alreadyVerified: true }
  }

  if (!hasPendingPhoneChange(authData.user)) {
    return {
      error: 'Phone verification SMS was not created. Check Supabase Auth phone confirmations and SMS provider settings.',
    }
  }

  const { error: profileError } = await auth.supabase
    .from('profiles')
    .update({
      phone_number: phone,
      phone_verified_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', auth.user.id)

  if (profileError) return { error: profileError.message }

  revalidateContactPaths()
  return { success: true, phoneNumber: phone }
}

export async function verifyAccountPhoneOtp(phoneNumber: string, token: string): Promise<ActionResult> {
  const auth = await getAuthenticatedUser()
  if ('error' in auth) return { error: auth.error }

  const normalized = normalizePhoneNumber(phoneNumber)
  if (normalized.error) return { error: normalized.error }
  const phone = normalized.value
  if (!phone) return { error: 'Invalid phone number.' }

  const otp = normalizeOtpToken(token)
  if (!otp) return { error: 'Enter the 6-digit verification code.' }

  const { error: verifyError } = await auth.supabase.auth.verifyOtp({
    phone,
    token: otp,
    type: 'phone_change',
  })

  if (verifyError) return { error: verifyError.message }

  const verifiedAt = new Date().toISOString()
  const { error: profileError } = await auth.supabase
    .from('profiles')
    .update({
      phone_number: phone,
      phone_verified_at: verifiedAt,
      updated_at: verifiedAt,
    })
    .eq('id', auth.user.id)

  if (profileError) return { error: profileError.message }

  revalidateContactPaths()
  return { success: true, phoneNumber: phone }
}
