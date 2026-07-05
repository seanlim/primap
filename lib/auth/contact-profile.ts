export const GUARDIAN_AGE_THRESHOLD = 18

export interface ContactProfileFields {
  phone_number: string | null
  phone_verified_at: string | null
  birth_month: string | null
}

export interface ContactDetailsInput {
  fullName?: string | null
  phoneNumber: string
  birthMonth: string
}

export interface ValidatedContactDetails {
  fullName: string | null
  phoneNumber: string
  birthMonth: string
}

export interface RoundDateRange {
  start_date: string
  end_date: string
}

export type ValidationResult<T> =
  | { value: T; error?: never }
  | { value?: never; error: string }

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const MONTH_PATTERN = /^(\d{4})-(\d{2})(?:-01)?$/
const ALLOWED_PHONE_PATTERN = /^[+\d\s().-]+$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function dateFromIsoDate(value: string): Date | null {
  const match = ISO_DATE_PATTERN.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  return date
}

function isoDateFromDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function isoMonthFromDate(date: Date): string {
  return date.toISOString().slice(0, 7)
}

function addMonthsToIsoMonth(birthMonth: string, months: number): string | null {
  const date = dateFromIsoDate(birthMonth)
  if (!date) return null

  return isoDateFromDate(new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth() + months,
    1
  )))
}

function formatDigitGroups(digits: string, groupSize = 3): string {
  const groups: string[] = []
  for (let index = 0; index < digits.length; index += groupSize) {
    groups.push(digits.slice(index, index + groupSize))
  }
  return groups.join(' ')
}

function formatSingaporeLocalDigits(digits: string): string {
  if (digits.length <= 4) return digits

  const localDigits = digits.slice(0, 8)
  const overflow = digits.slice(8)
  return [
    localDigits.slice(0, 4),
    localDigits.slice(4),
    overflow,
  ].filter(Boolean).join(' ')
}

export function formatPhoneNumberInput(value: string): string {
  const trimmed = value.trim()
  const hasLeadingPlus = trimmed.startsWith('+')
  const digits = value.replace(/\D/g, '').slice(0, 15)
  if (!digits) return hasLeadingPlus ? '+' : ''

  const hasSingaporeCountryCode = digits.startsWith('65') && /^[3689]/.test(digits.slice(2, 3))
  if (hasLeadingPlus && hasSingaporeCountryCode) {
    const formattedLocal = formatSingaporeLocalDigits(digits.slice(2))
    return formattedLocal ? `+65 ${formattedLocal}` : '+65'
  }

  if (!hasLeadingPlus && hasSingaporeCountryCode && digits.length >= 10) {
    return `+65 ${formatSingaporeLocalDigits(digits.slice(2))}`
  }

  if (!hasLeadingPlus && /^[3689]/.test(digits) && digits.length <= 8) {
    return formatSingaporeLocalDigits(digits)
  }

  return `${hasLeadingPlus ? '+' : ''}${formatDigitGroups(digits)}`
}

export function normalizeBirthMonth(value: string, referenceDate = new Date()): ValidationResult<string> {
  const trimmed = value.trim()
  const match = MONTH_PATTERN.exec(trimmed)
  if (!match) return { error: 'Enter a valid birth month.' }

  const year = Number(match[1])
  const month = Number(match[2])
  if (month < 1 || month > 12) return { error: 'Enter a valid birth month.' }

  const normalized = `${year.toString().padStart(4, '0')}-${match[2]}-01`
  const currentMonth = `${isoMonthFromDate(referenceDate)}-01`
  if (normalized > currentMonth) return { error: 'Birth month cannot be in the future.' }

  return { value: normalized }
}

export function birthMonthToInput(value: string | null): string {
  const normalized = value ? normalizeBirthMonth(value) : { value: '' }
  return normalized.value ? normalized.value.slice(0, 7) : ''
}

export function getAdultStartMonth(birthMonth: string): string | null {
  const normalized = normalizeBirthMonth(birthMonth)
  if (normalized.error || !normalized.value) return null

  return addMonthsToIsoMonth(normalized.value, GUARDIAN_AGE_THRESHOLD * 12 + 1)
}

export function requiresGuardianContact(birthMonth: string, referenceDate = new Date()): boolean {
  const adultStartMonth = getAdultStartMonth(birthMonth)
  if (!adultStartMonth) return false

  return isoDateFromDate(referenceDate) < adultStartMonth
}

export function requiresGuardianForRound(
  birthMonth: string | null,
  round: RoundDateRange
): boolean {
  if (!birthMonth) return false

  const adultStartMonth = getAdultStartMonth(birthMonth)
  if (!adultStartMonth) return false

  return round.start_date < adultStartMonth && round.end_date >= birthMonth
}

export function normalizePhoneNumber(value: string, label = 'Phone number'): ValidationResult<string> {
  const trimmed = value.trim()
  if (!trimmed) return { error: `${label} is required.` }
  if (!ALLOWED_PHONE_PATTERN.test(trimmed)) {
    return { error: `${label} can only include digits, spaces, +, hyphens, dots, or parentheses.` }
  }

  const compact = trimmed.replace(/[\s().-]/g, '')
  if ((compact.match(/\+/g) ?? []).length > 1 || (compact.includes('+') && !compact.startsWith('+'))) {
    return { error: `${label} has an invalid country code.` }
  }

  const digits = compact.startsWith('+') ? compact.slice(1) : compact
  if (!/^\d{8,15}$/.test(digits)) {
    return { error: `${label} must contain 8 to 15 digits.` }
  }

  if (compact.startsWith('+')) return { value: `+${digits}` }

  if (/^[3689]\d{7}$/.test(digits)) return { value: `+65${digits}` }
  if (/^65[3689]\d{7}$/.test(digits)) return { value: `+${digits}` }

  return { value: `+${digits}` }
}

export function normalizeEmailAddress(value: string, label = 'Email'): ValidationResult<string> {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return { error: `${label} is required.` }
  if (!EMAIL_PATTERN.test(normalized)) return { error: `Enter a valid ${label.toLowerCase()}.` }
  return { value: normalized }
}

export function isVerifiedPhone(phoneNumber: string | null, verifiedAt: string | null): boolean {
  return Boolean(phoneNumber?.trim() && verifiedAt)
}

export function getProfileContactMissingFields(profile: ContactProfileFields): string[] {
  const missing: string[] = []

  if (!profile.birth_month) missing.push('birth_month')
  if (!profile.phone_number) missing.push('phone_number')
  if (!profile.phone_verified_at) missing.push('phone_verified_at')

  return missing
}

export function isProfileContactComplete(profile: ContactProfileFields): boolean {
  return getProfileContactMissingFields(profile).length === 0
}

export function validateContactDetails(input: ContactDetailsInput): ValidationResult<ValidatedContactDetails> {
  const phone = normalizePhoneNumber(input.phoneNumber)
  if (phone.error) return { error: phone.error }
  const normalizedPhone = phone.value
  if (!normalizedPhone) return { error: 'Invalid phone number.' }

  const birthMonth = normalizeBirthMonth(input.birthMonth)
  if (birthMonth.error) return { error: birthMonth.error }
  const normalizedBirthMonth = birthMonth.value
  if (!normalizedBirthMonth) return { error: 'Enter a valid birth month.' }

  return {
    value: {
      fullName: input.fullName?.trim() || null,
      phoneNumber: normalizedPhone,
      birthMonth: normalizedBirthMonth,
    },
  }
}
