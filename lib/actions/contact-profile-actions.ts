'use server'

import { createHash, randomInt } from 'crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  type ContactDetailsInput,
  normalizePhoneNumber,
  requiresGuardianContact,
  validateContactDetails,
} from '@/lib/auth/contact-profile'
import { sendSms } from '@/lib/sms/twilio'

interface ActionResult {
  success?: true
  error?: string
  phoneNumber?: string
}

const OTP_EXPIRY_MINUTES = 10
const OTP_RESEND_SECONDS = 60
const OTP_MAX_ATTEMPTS = 5

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

function createOtpCode(): string {
  if (process.env.GUARDIAN_OTP_TEST_CODE && process.env.NODE_ENV !== 'production') {
    return process.env.GUARDIAN_OTP_TEST_CODE
  }

  return randomInt(0, 1_000_000).toString().padStart(6, '0')
}

function hashGuardianOtp(userId: string, phoneNumber: string, code: string): string {
  const secret =
    process.env.GUARDIAN_OTP_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'local-guardian-otp-secret'

  return createHash('sha256')
    .update(`${secret}:${userId}:${phoneNumber}:${code}`)
    .digest('hex')
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
    .select('phone_number, phone_verified_at, guardian_phone_number, guardian_phone_verified_at')
    .eq('id', auth.user.id)
    .single()

  if (fetchError) return { error: fetchError.message }

  const currentPhoneStillVerified = currentProfile?.phone_number === contact.phoneNumber
  const currentGuardianStillVerified =
    contact.guardianPhoneNumber !== null &&
    currentProfile?.guardian_phone_number === contact.guardianPhoneNumber

  const { error } = await auth.supabase
    .from('profiles')
    .update({
      full_name: contact.fullName,
      phone_number: contact.phoneNumber,
      phone_verified_at: currentPhoneStillVerified ? currentProfile.phone_verified_at : null,
      date_of_birth: contact.dateOfBirth,
      guardian_phone_number: contact.guardianPhoneNumber,
      guardian_phone_verified_at: currentGuardianStillVerified
        ? currentProfile.guardian_phone_verified_at
        : null,
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

  const { error: authError } = await auth.supabase.auth.updateUser({
    phone,
  })

  if (authError) return { error: authError.message }

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

export async function sendGuardianPhoneOtp(phoneNumber: string): Promise<ActionResult> {
  const auth = await getAuthenticatedUser()
  if ('error' in auth) return { error: auth.error }

  const normalized = normalizePhoneNumber(phoneNumber, 'Guardian phone number')
  if (normalized.error) return { error: normalized.error }
  const phone = normalized.value
  if (!phone) return { error: 'Invalid guardian phone number.' }

  const { data: profile, error: profileError } = await auth.supabase
    .from('profiles')
    .select('date_of_birth')
    .eq('id', auth.user.id)
    .single()

  if (profileError) return { error: profileError.message }
  if (!profile?.date_of_birth || !requiresGuardianContact(profile.date_of_birth)) {
    return { error: 'Guardian verification is only required for users under 18.' }
  }

  const admin = createAdminClient()
  const { data: recentOtp } = await admin
    .from('guardian_phone_otps')
    .select('created_at')
    .eq('user_id', auth.user.id)
    .eq('phone_number', phone)
    .is('verified_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (recentOtp?.created_at) {
    const secondsSinceLast = (Date.now() - new Date(recentOtp.created_at).getTime()) / 1000
    if (secondsSinceLast < OTP_RESEND_SECONDS) {
      return { error: 'Please wait before requesting another guardian code.' }
    }
  }

  const code = createOtpCode()
  const sent = await sendSms({
    to: phone,
    body: `Your Primap guardian verification code is ${code}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`,
  })
  if (sent.error) return { error: sent.error }

  const now = new Date()
  const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString()
  const { error: insertError } = await admin
    .from('guardian_phone_otps')
    .insert({
      user_id: auth.user.id,
      phone_number: phone,
      code_hash: hashGuardianOtp(auth.user.id, phone, code),
      expires_at: expiresAt,
      attempts: 0,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    })

  if (insertError) return { error: insertError.message }

  const { error: profileUpdateError } = await auth.supabase
    .from('profiles')
    .update({
      guardian_phone_number: phone,
      guardian_phone_verified_at: null,
      updated_at: now.toISOString(),
    })
    .eq('id', auth.user.id)

  if (profileUpdateError) return { error: profileUpdateError.message }

  revalidateContactPaths()
  return { success: true, phoneNumber: phone }
}

export async function verifyGuardianPhoneOtp(phoneNumber: string, token: string): Promise<ActionResult> {
  const auth = await getAuthenticatedUser()
  if ('error' in auth) return { error: auth.error }

  const normalized = normalizePhoneNumber(phoneNumber, 'Guardian phone number')
  if (normalized.error) return { error: normalized.error }
  const phone = normalized.value
  if (!phone) return { error: 'Invalid guardian phone number.' }

  const otp = normalizeOtpToken(token)
  if (!otp) return { error: 'Enter the 6-digit guardian verification code.' }

  const admin = createAdminClient()
  const { data: otpRow, error: fetchError } = await admin
    .from('guardian_phone_otps')
    .select('id, code_hash, attempts, expires_at')
    .eq('user_id', auth.user.id)
    .eq('phone_number', phone)
    .is('verified_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (fetchError) return { error: fetchError.message }
  if (!otpRow) return { error: 'Request a guardian verification code first.' }
  if (new Date(otpRow.expires_at).getTime() < Date.now()) {
    return { error: 'Guardian verification code has expired.' }
  }
  if (otpRow.attempts >= OTP_MAX_ATTEMPTS) {
    return { error: 'Too many incorrect attempts. Request a new guardian code.' }
  }

  const expectedHash = hashGuardianOtp(auth.user.id, phone, otp)
  if (otpRow.code_hash !== expectedHash) {
    await admin
      .from('guardian_phone_otps')
      .update({
        attempts: otpRow.attempts + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', otpRow.id)

    return { error: 'Guardian verification code is incorrect.' }
  }

  const verifiedAt = new Date().toISOString()
  const { error: otpUpdateError } = await admin
    .from('guardian_phone_otps')
    .update({
      verified_at: verifiedAt,
      updated_at: verifiedAt,
    })
    .eq('id', otpRow.id)

  if (otpUpdateError) return { error: otpUpdateError.message }

  const { error: profileError } = await auth.supabase
    .from('profiles')
    .update({
      guardian_phone_number: phone,
      guardian_phone_verified_at: verifiedAt,
      updated_at: verifiedAt,
    })
    .eq('id', auth.user.id)

  if (profileError) return { error: profileError.message }

  revalidateContactPaths()
  return { success: true, phoneNumber: phone }
}
