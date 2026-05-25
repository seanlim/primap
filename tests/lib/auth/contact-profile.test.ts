import {
  calculateAge,
  isProfileContactComplete,
  normalizeDateOfBirth,
  normalizePhoneNumber,
  requiresGuardianContact,
  validateContactDetails,
} from '@/lib/auth/contact-profile'

describe('contact-profile', () => {
  const now = new Date('2026-05-25T00:00:00.000Z')

  it('normalizes Singapore-style local phone numbers to E.164', () => {
    expect(normalizePhoneNumber('9123 4567')).toEqual({ value: '+6591234567' })
    expect(normalizePhoneNumber('65 8123-4567')).toEqual({ value: '+6581234567' })
    expect(normalizePhoneNumber('+65 6123 4567')).toEqual({ value: '+6561234567' })
  })

  it('rejects blank or malformed phone numbers', () => {
    expect(normalizePhoneNumber('')).toEqual({ error: 'Phone number is required.' })
    expect(normalizePhoneNumber('phone-me')).toEqual({
      error: 'Phone number can only include digits, spaces, +, hyphens, dots, or parentheses.',
    })
    expect(normalizePhoneNumber('123')).toEqual({ error: 'Phone number must contain 8 to 15 digits.' })
  })

  it('validates date of birth and age threshold', () => {
    expect(normalizeDateOfBirth('2008-05-25', now)).toEqual({ value: '2008-05-25' })
    expect(normalizeDateOfBirth('2027-01-01', now)).toEqual({
      error: 'Date of birth cannot be in the future.',
    })
    expect(calculateAge('2008-05-26', now)).toBe(17)
    expect(calculateAge('2008-05-25', now)).toBe(18)
    expect(requiresGuardianContact('2008-05-26', now)).toBe(true)
    expect(requiresGuardianContact('2008-05-25', now)).toBe(false)
  })

  it('requires guardian contact for under-18 users', () => {
    expect(validateContactDetails({
      phoneNumber: '91234567',
      dateOfBirth: '2010-01-01',
    }, now)).toEqual({ error: 'Guardian phone number is required.' })

    expect(validateContactDetails({
      fullName: ' Minor User ',
      phoneNumber: '91234567',
      dateOfBirth: '2010-01-01',
      guardianPhoneNumber: '81234567',
    }, now)).toEqual({
      value: {
        fullName: 'Minor User',
        phoneNumber: '+6591234567',
        dateOfBirth: '2010-01-01',
        guardianPhoneNumber: '+6581234567',
        requiresGuardian: true,
      },
    })
  })

  it('checks profile completion including guardian verification when needed', () => {
    expect(isProfileContactComplete({
      phone_number: '+6591234567',
      phone_verified_at: '2026-01-01T00:00:00.000Z',
      date_of_birth: '1990-01-01',
      guardian_phone_number: null,
      guardian_phone_verified_at: null,
    }, now)).toBe(true)

    expect(isProfileContactComplete({
      phone_number: '+6591234567',
      phone_verified_at: '2026-01-01T00:00:00.000Z',
      date_of_birth: '2010-01-01',
      guardian_phone_number: '+6581234567',
      guardian_phone_verified_at: null,
    }, now)).toBe(false)
  })
})
