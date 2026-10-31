const E164_PATTERN = /^\+[1-9]\d{7,14}$/
const SG_LOCAL_PATTERN = /^[3689]\d{7}$/
const SG_WITH_COUNTRY_CODE_PATTERN = /^65[3689]\d{7}$/

export const PHONE_REQUIRED_MESSAGE = 'Add a phone number to your profile.'
export const PHONE_INVALID_MESSAGE = 'Enter a valid phone number, e.g. +65 9123 4567.'

export type PhoneValidation =
  | { ok: true; e164: string }
  | { ok: false; error: string }

/**
 * Normalises user input to E.164.
 *
 * Singapore-friendly: an 8-digit local number (or 65-prefixed number) becomes
 * +65XXXXXXXX. International numbers must include a leading "+".
 */
export function normalizePhone(input: string | null | undefined): PhoneValidation {
  const raw = (input ?? '').trim()
  if (!raw) return { ok: false, error: PHONE_REQUIRED_MESSAGE }

  const compact = raw.replace(/[\s\-().]/g, '')
  const digits = compact.replace(/\D/g, '')
  if (!digits) return { ok: false, error: PHONE_INVALID_MESSAGE }

  let e164: string
  if (compact.startsWith('+')) {
    e164 = `+${digits}`
  } else if (SG_LOCAL_PATTERN.test(digits)) {
    e164 = `+65${digits}`
  } else if (SG_WITH_COUNTRY_CODE_PATTERN.test(digits)) {
    e164 = `+${digits}`
  } else {
    return { ok: false, error: PHONE_INVALID_MESSAGE }
  }

  if (!E164_PATTERN.test(e164)) {
    return { ok: false, error: PHONE_INVALID_MESSAGE }
  }

  return { ok: true, e164 }
}

/** Formats a stored E.164 number for display, including Singapore spacing. */
export function formatPhoneForDisplay(phoneNumber: string | null | undefined): string {
  const value = (phoneNumber ?? '').trim()
  if (!value) return ''
  if (/^\+65\d{8}$/.test(value)) {
    return `+65 ${value.slice(3, 7)} ${value.slice(7)}`
  }
  return value
}

/** True when a profile has a usable phone number stored. */
export function hasPhone(phoneNumber: string | null | undefined): boolean {
  return Boolean(phoneNumber?.trim())
}
