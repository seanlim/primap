export const GUARDIAN_AGE_THRESHOLD = 18

export interface ContactProfileFields {
  phone_number: string | null
  phone_verified_at: string | null
  date_of_birth: string | null
  guardian_phone_number: string | null
  guardian_phone_verified_at: string | null
}

export interface ContactDetailsInput {
  fullName?: string | null
  phoneNumber: string
  dateOfBirth: string
  guardianPhoneNumber?: string | null
}

export interface ValidatedContactDetails {
  fullName: string | null
  phoneNumber: string
  dateOfBirth: string
  guardianPhoneNumber: string | null
  requiresGuardian: boolean
}

export type ValidationResult<T> =
  | { value: T; error?: never }
  | { value?: never; error: string }

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const ALLOWED_PHONE_PATTERN = /^[+\d\s().-]+$/

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

export function normalizeDateOfBirth(value: string, referenceDate = new Date()): ValidationResult<string> {
  const trimmed = value.trim()
  const date = dateFromIsoDate(trimmed)
  if (!date) return { error: 'Enter a valid date of birth.' }

  const today = isoDateFromDate(referenceDate)
  if (trimmed > today) return { error: 'Date of birth cannot be in the future.' }

  return { value: trimmed }
}

export function calculateAge(dateOfBirth: string, referenceDate = new Date()): number | null {
  const birthDate = dateFromIsoDate(dateOfBirth)
  if (!birthDate) return null

  let age = referenceDate.getUTCFullYear() - birthDate.getUTCFullYear()
  const currentMonth = referenceDate.getUTCMonth()
  const birthMonth = birthDate.getUTCMonth()
  const hasHadBirthday =
    currentMonth > birthMonth ||
    (currentMonth === birthMonth && referenceDate.getUTCDate() >= birthDate.getUTCDate())

  if (!hasHadBirthday) age -= 1
  return age
}

export function requiresGuardianContact(dateOfBirth: string, referenceDate = new Date()): boolean {
  const age = calculateAge(dateOfBirth, referenceDate)
  return age !== null && age < GUARDIAN_AGE_THRESHOLD
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

export function isVerifiedPhone(phoneNumber: string | null, verifiedAt: string | null): boolean {
  return Boolean(phoneNumber?.trim() && verifiedAt)
}

export function getProfileContactMissingFields(
  profile: ContactProfileFields,
  referenceDate = new Date()
): string[] {
  const missing: string[] = []

  if (!profile.date_of_birth) missing.push('date_of_birth')
  if (!profile.phone_number) missing.push('phone_number')
  if (!profile.phone_verified_at) missing.push('phone_verified_at')

  if (profile.date_of_birth && requiresGuardianContact(profile.date_of_birth, referenceDate)) {
    if (!profile.guardian_phone_number) missing.push('guardian_phone_number')
    if (!profile.guardian_phone_verified_at) missing.push('guardian_phone_verified_at')
  }

  return missing
}

export function isProfileContactComplete(
  profile: ContactProfileFields,
  referenceDate = new Date()
): boolean {
  return getProfileContactMissingFields(profile, referenceDate).length === 0
}

export function validateContactDetails(
  input: ContactDetailsInput,
  referenceDate = new Date()
): ValidationResult<ValidatedContactDetails> {
  const phone = normalizePhoneNumber(input.phoneNumber)
  if (phone.error) return { error: phone.error }
  const normalizedPhone = phone.value
  if (!normalizedPhone) return { error: 'Invalid phone number.' }

  const dateOfBirth = normalizeDateOfBirth(input.dateOfBirth, referenceDate)
  if (dateOfBirth.error) return { error: dateOfBirth.error }
  const normalizedDateOfBirth = dateOfBirth.value
  if (!normalizedDateOfBirth) return { error: 'Enter a valid date of birth.' }

  const requiresGuardian = requiresGuardianContact(normalizedDateOfBirth, referenceDate)
  let guardianPhoneNumber: string | null = null

  if (requiresGuardian) {
    const guardianPhone = normalizePhoneNumber(input.guardianPhoneNumber ?? '', 'Guardian phone number')
    if (guardianPhone.error) return { error: guardianPhone.error }
    if (!guardianPhone.value) return { error: 'Guardian phone number is required.' }
    guardianPhoneNumber = guardianPhone.value
  }

  return {
    value: {
      fullName: input.fullName?.trim() || null,
      phoneNumber: normalizedPhone,
      dateOfBirth: normalizedDateOfBirth,
      guardianPhoneNumber,
      requiresGuardian,
    },
  }
}
