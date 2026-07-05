'use server'

import { createHash, randomInt } from 'crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  normalizeEmailAddress,
  normalizePhoneNumber,
  requiresGuardianForRound,
} from '@/lib/auth/contact-profile'
import { sendGuardianEmailVerificationEmail } from '@/lib/email'
import { sendSms } from '@/lib/sms/twilio'

type GuardianOtpChannel = 'EMAIL' | 'SMS'

interface ActionResult {
  success?: true
  error?: string
  guardianEmail?: string
  guardianPhoneNumber?: string
  indemnityAcknowledgedAt?: string
}

export interface RoundRequirementsInput {
  indemnityAcknowledged?: boolean
  guardianName?: string | null
  guardianEmail?: string | null
  guardianPhoneNumber?: string | null
}

const OTP_EXPIRY_MINUTES = 10
const OTP_RESEND_SECONDS = 60
const OTP_MAX_ATTEMPTS = 5

function revalidateRoundRequirementPaths(roundId: string) {
  revalidatePath('/walk')
  revalidatePath('/home')
  revalidatePath('/profile')
  revalidatePath(`/admin/rounds/${roundId}/walks`)
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

function hashGuardianOtp(
  userId: string,
  roundId: string,
  channel: GuardianOtpChannel,
  destination: string,
  code: string
): string {
  const secret =
    process.env.GUARDIAN_OTP_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'local-guardian-otp-secret'

  return createHash('sha256')
    .update(`${secret}:${userId}:${roundId}:${channel}:${destination}:${code}`)
    .digest('hex')
}

async function getAuthenticatedUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const }
  return { supabase, user }
}

async function getRoundContext(userId: string, roundId: string) {
  const admin = createAdminClient()
  const [{ data: profile, error: profileError }, { data: round, error: roundError }, { data: requirement, error: requirementError }] = await Promise.all([
    admin
      .from('profiles')
      .select('id, full_name, birth_month')
      .eq('id', userId)
      .single(),
    admin
      .from('survey_rounds')
      .select('id, start_date, end_date, indemnity_form_url')
      .eq('id', roundId)
      .single(),
    admin
      .from('round_participation_requirements')
      .select('indemnity_acknowledged_at, guardian_name, guardian_email, guardian_email_verified_at, guardian_phone_number, guardian_phone_verified_at')
      .eq('user_id', userId)
      .eq('round_id', roundId)
      .maybeSingle(),
  ])

  if (profileError) return { error: profileError.message }
  if (roundError) return { error: roundError.message }
  if (requirementError) return { error: requirementError.message }
  if (!profile) return { error: 'Profile not found.' }
  if (!round) return { error: 'Round not found.' }

  return {
    admin,
    profile,
    round,
    requirement,
    needsGuardian: requiresGuardianForRound(profile.birth_month, round),
  }
}

async function ensureGuardianRequired(userId: string, roundId: string) {
  const context = await getRoundContext(userId, roundId)
  if ('error' in context) return context
  if (!context.needsGuardian) {
    return { error: 'Guardian verification is only required for users under 18 for this round.' }
  }
  return context
}

export async function saveRoundRequirements(
  roundId: string,
  input: RoundRequirementsInput
): Promise<ActionResult> {
  const auth = await getAuthenticatedUser()
  if ('error' in auth) return { error: auth.error }
  if (!roundId) return { error: 'Round is required.' }

  const context = await getRoundContext(auth.user.id, roundId)
  if ('error' in context) return { error: context.error }
  const { admin, round, requirement, needsGuardian } = context

  if (!round.indemnity_form_url && !requirement?.indemnity_acknowledged_at) {
    return { error: 'Indemnity form is not configured for this round.' }
  }

  const now = new Date().toISOString()
  const indemnityAcknowledgedAt =
    requirement?.indemnity_acknowledged_at ||
    (input.indemnityAcknowledged ? now : null)

  let guardianName: string | null = null
  let guardianEmail: string | null = null
  let guardianPhoneNumber: string | null = null
  let guardianEmailVerifiedAt: string | null = null
  let guardianPhoneVerifiedAt: string | null = null

  if (needsGuardian) {
    guardianName = input.guardianName?.trim() || null
    if (!guardianName) return { error: 'Guardian name is required.' }

    const email = normalizeEmailAddress(input.guardianEmail ?? '', 'Guardian email')
    if (email.error) return { error: email.error }
    guardianEmail = email.value ?? null
    if (!guardianEmail) return { error: 'Guardian email is required.' }

    const phone = normalizePhoneNumber(input.guardianPhoneNumber ?? '', 'Guardian phone number')
    if (phone.error) return { error: phone.error }
    guardianPhoneNumber = phone.value ?? null
    if (!guardianPhoneNumber) return { error: 'Guardian phone number is required.' }

    guardianEmailVerifiedAt =
      requirement?.guardian_email === guardianEmail
        ? requirement.guardian_email_verified_at
        : null
    guardianPhoneVerifiedAt =
      requirement?.guardian_phone_number === guardianPhoneNumber
        ? requirement.guardian_phone_verified_at
        : null
  }

  const { error } = await admin
    .from('round_participation_requirements')
    .upsert({
      user_id: auth.user.id,
      round_id: roundId,
      indemnity_acknowledged_at: indemnityAcknowledgedAt,
      guardian_name: guardianName,
      guardian_email: guardianEmail,
      guardian_email_verified_at: guardianEmailVerifiedAt,
      guardian_phone_number: guardianPhoneNumber,
      guardian_phone_verified_at: guardianPhoneVerifiedAt,
      updated_at: now,
    }, { onConflict: 'user_id,round_id' })

  if (error) return { error: error.message }

  revalidateRoundRequirementPaths(roundId)
  return {
    success: true,
    indemnityAcknowledgedAt: indemnityAcknowledgedAt ?? undefined,
    guardianEmail: guardianEmail ?? undefined,
    guardianPhoneNumber: guardianPhoneNumber ?? undefined,
  }
}

async function createGuardianOtp({
  userId,
  roundId,
  channel,
  destination,
  send,
}: {
  userId: string
  roundId: string
  channel: GuardianOtpChannel
  destination: string
  send: (code: string) => Promise<ActionResult>
}): Promise<ActionResult> {
  const admin = createAdminClient()
  const { data: recentOtp } = await admin
    .from('guardian_contact_otps')
    .select('created_at')
    .eq('user_id', userId)
    .eq('round_id', roundId)
    .eq('channel', channel)
    .eq('destination', destination)
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
  const sent = await send(code)
  if (sent.error) return sent

  const now = new Date()
  const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString()
  const { error } = await admin
    .from('guardian_contact_otps')
    .insert({
      user_id: userId,
      round_id: roundId,
      channel,
      destination,
      code_hash: hashGuardianOtp(userId, roundId, channel, destination, code),
      expires_at: expiresAt,
      attempts: 0,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    })

  if (error) return { error: error.message }
  return { success: true }
}

export async function sendGuardianEmailOtp(roundId: string, emailAddress: string): Promise<ActionResult> {
  const auth = await getAuthenticatedUser()
  if ('error' in auth) return { error: auth.error }

  const context = await ensureGuardianRequired(auth.user.id, roundId)
  if ('error' in context) return { error: context.error }

  const email = normalizeEmailAddress(emailAddress, 'Guardian email')
  if (email.error) return { error: email.error }
  const guardianEmail = email.value
  if (!guardianEmail) return { error: 'Guardian email is required.' }

  if (!process.env.RESEND_API_KEY && !(process.env.GUARDIAN_OTP_TEST_CODE && process.env.NODE_ENV !== 'production')) {
    return { error: 'Unable to send guardian email code. Check Resend settings.' }
  }

  const result = await createGuardianOtp({
    userId: auth.user.id,
    roundId,
    channel: 'EMAIL',
    destination: guardianEmail,
    send: async (code) => {
      await sendGuardianEmailVerificationEmail(
        guardianEmail,
        context.requirement?.guardian_name ?? null,
        context.profile.full_name,
        code
      )
      return { success: true }
    },
  })
  if (result.error) return result

  const { error } = await context.admin
    .from('round_participation_requirements')
    .upsert({
      user_id: auth.user.id,
      round_id: roundId,
      guardian_email: guardianEmail,
      guardian_email_verified_at: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,round_id' })

  if (error) return { error: error.message }
  revalidateRoundRequirementPaths(roundId)
  return { success: true, guardianEmail }
}

export async function sendGuardianPhoneOtp(roundId: string, phoneNumber: string): Promise<ActionResult> {
  const auth = await getAuthenticatedUser()
  if ('error' in auth) return { error: auth.error }

  const context = await ensureGuardianRequired(auth.user.id, roundId)
  if ('error' in context) return { error: context.error }

  const phone = normalizePhoneNumber(phoneNumber, 'Guardian phone number')
  if (phone.error) return { error: phone.error }
  const guardianPhoneNumber = phone.value
  if (!guardianPhoneNumber) return { error: 'Guardian phone number is required.' }

  const result = await createGuardianOtp({
    userId: auth.user.id,
    roundId,
    channel: 'SMS',
    destination: guardianPhoneNumber,
    send: async (code) => sendSms({
      to: guardianPhoneNumber,
      body: `Your Primap guardian verification code is ${code}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`,
    }),
  })
  if (result.error) return result

  const { error } = await context.admin
    .from('round_participation_requirements')
    .upsert({
      user_id: auth.user.id,
      round_id: roundId,
      guardian_phone_number: guardianPhoneNumber,
      guardian_phone_verified_at: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,round_id' })

  if (error) return { error: error.message }
  revalidateRoundRequirementPaths(roundId)
  return { success: true, guardianPhoneNumber }
}

async function verifyGuardianOtp({
  userId,
  roundId,
  channel,
  destination,
  token,
}: {
  userId: string
  roundId: string
  channel: GuardianOtpChannel
  destination: string
  token: string
}): Promise<ActionResult> {
  const otp = normalizeOtpToken(token)
  if (!otp) return { error: 'Enter the 6-digit guardian verification code.' }

  const admin = createAdminClient()
  const { data: otpRow, error: fetchError } = await admin
    .from('guardian_contact_otps')
    .select('id, code_hash, attempts, expires_at')
    .eq('user_id', userId)
    .eq('round_id', roundId)
    .eq('channel', channel)
    .eq('destination', destination)
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

  const expectedHash = hashGuardianOtp(userId, roundId, channel, destination, otp)
  if (otpRow.code_hash !== expectedHash) {
    await admin
      .from('guardian_contact_otps')
      .update({
        attempts: otpRow.attempts + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', otpRow.id)

    return { error: 'Guardian verification code is incorrect.' }
  }

  const verifiedAt = new Date().toISOString()
  const { error } = await admin
    .from('guardian_contact_otps')
    .update({
      verified_at: verifiedAt,
      updated_at: verifiedAt,
    })
    .eq('id', otpRow.id)

  if (error) return { error: error.message }
  return { success: true }
}

export async function verifyGuardianEmailOtp(
  roundId: string,
  emailAddress: string,
  token: string
): Promise<ActionResult> {
  const auth = await getAuthenticatedUser()
  if ('error' in auth) return { error: auth.error }

  const context = await ensureGuardianRequired(auth.user.id, roundId)
  if ('error' in context) return { error: context.error }

  const email = normalizeEmailAddress(emailAddress, 'Guardian email')
  if (email.error) return { error: email.error }
  const guardianEmail = email.value
  if (!guardianEmail) return { error: 'Guardian email is required.' }

  const result = await verifyGuardianOtp({
    userId: auth.user.id,
    roundId,
    channel: 'EMAIL',
    destination: guardianEmail,
    token,
  })
  if (result.error) return result

  const verifiedAt = new Date().toISOString()
  const { error } = await context.admin
    .from('round_participation_requirements')
    .upsert({
      user_id: auth.user.id,
      round_id: roundId,
      guardian_email: guardianEmail,
      guardian_email_verified_at: verifiedAt,
      updated_at: verifiedAt,
    }, { onConflict: 'user_id,round_id' })

  if (error) return { error: error.message }
  revalidateRoundRequirementPaths(roundId)
  return { success: true, guardianEmail }
}

export async function verifyGuardianPhoneOtp(
  roundId: string,
  phoneNumber: string,
  token: string
): Promise<ActionResult> {
  const auth = await getAuthenticatedUser()
  if ('error' in auth) return { error: auth.error }

  const context = await ensureGuardianRequired(auth.user.id, roundId)
  if ('error' in context) return { error: context.error }

  const phone = normalizePhoneNumber(phoneNumber, 'Guardian phone number')
  if (phone.error) return { error: phone.error }
  const guardianPhoneNumber = phone.value
  if (!guardianPhoneNumber) return { error: 'Guardian phone number is required.' }

  const result = await verifyGuardianOtp({
    userId: auth.user.id,
    roundId,
    channel: 'SMS',
    destination: guardianPhoneNumber,
    token,
  })
  if (result.error) return result

  const verifiedAt = new Date().toISOString()
  const { error } = await context.admin
    .from('round_participation_requirements')
    .upsert({
      user_id: auth.user.id,
      round_id: roundId,
      guardian_phone_number: guardianPhoneNumber,
      guardian_phone_verified_at: verifiedAt,
      updated_at: verifiedAt,
    }, { onConflict: 'user_id,round_id' })

  if (error) return { error: error.message }
  revalidateRoundRequirementPaths(roundId)
  return { success: true, guardianPhoneNumber }
}
