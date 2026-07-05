import {
  birthMonthToInput,
  formatPhoneNumberInput,
  getAdultStartMonth,
  isProfileContactComplete,
  normalizeBirthMonth,
  normalizePhoneNumber,
  requiresGuardianContact,
  requiresGuardianForRound,
  validateContactDetails,
} from '@/lib/auth/contact-profile'
import { getRoundRequirementStatus } from '@/lib/auth/round-requirements'

describe('contact-profile', () => {
  const now = new Date('2026-05-25T00:00:00.000Z')

  it('normalizes Singapore-style local phone numbers to E.164', () => {
    expect(normalizePhoneNumber('9123 4567')).toEqual({ value: '+6591234567' })
    expect(normalizePhoneNumber('65 8123-4567')).toEqual({ value: '+6581234567' })
    expect(normalizePhoneNumber('+65 6123 4567')).toEqual({ value: '+6561234567' })
    expect(formatPhoneNumberInput('91234567')).toBe('9123 4567')
  })

  it('rejects blank or malformed phone numbers', () => {
    expect(normalizePhoneNumber('')).toEqual({ error: 'Phone number is required.' })
    expect(normalizePhoneNumber('phone-me')).toEqual({
      error: 'Phone number can only include digits, spaces, +, hyphens, dots, or parentheses.',
    })
    expect(normalizePhoneNumber('123')).toEqual({ error: 'Phone number must contain 8 to 15 digits.' })
  })

  it('normalizes birth month and applies the conservative age threshold', () => {
    expect(normalizeBirthMonth('2008-05', now)).toEqual({ value: '2008-05-01' })
    expect(normalizeBirthMonth('2008-05-01', now)).toEqual({ value: '2008-05-01' })
    expect(normalizeBirthMonth('2027-01', now)).toEqual({
      error: 'Birth month cannot be in the future.',
    })
    expect(birthMonthToInput('2008-05-01')).toBe('2008-05')
    expect(getAdultStartMonth('2008-05-01')).toBe('2026-06-01')
    expect(requiresGuardianContact('2008-05-01', now)).toBe(true)
    expect(requiresGuardianContact('2008-04-01', now)).toBe(false)
  })

  it('requires guardians for rounds that start before the adult start month', () => {
    expect(requiresGuardianForRound('2008-05-01', {
      start_date: '2026-05-31',
      end_date: '2026-06-15',
    })).toBe(true)
    expect(requiresGuardianForRound('2008-05-01', {
      start_date: '2026-06-01',
      end_date: '2026-06-30',
    })).toBe(false)
  })

  it('validates global contact details without guardian fields', () => {
    expect(validateContactDetails({
      fullName: ' Minor User ',
      phoneNumber: '91234567',
      birthMonth: '2010-01',
    })).toEqual({
      value: {
        fullName: 'Minor User',
        phoneNumber: '+6591234567',
        birthMonth: '2010-01-01',
      },
    })
  })

  it('checks profile completion from birth month and verified account phone', () => {
    expect(isProfileContactComplete({
      phone_number: '+6591234567',
      phone_verified_at: '2026-01-01T00:00:00.000Z',
      birth_month: '1990-01-01',
    })).toBe(true)

    expect(isProfileContactComplete({
      phone_number: '+6591234567',
      phone_verified_at: null,
      birth_month: '2010-01-01',
    })).toBe(false)
  })

  it('checks round-specific indemnity and guardian verification requirements', () => {
    const status = getRoundRequirementStatus(
      { birth_month: '2010-01-01' },
      {
        start_date: '2026-05-01',
        end_date: '2026-05-31',
        indemnity_form_url: 'https://example.com/form',
      },
      {
        indemnity_acknowledged_at: '2026-01-01T00:00:00.000Z',
        guardian_name: 'Parent One',
        guardian_email: 'parent@example.com',
        guardian_email_verified_at: '2026-01-01T00:00:00.000Z',
        guardian_phone_number: '+6581234567',
        guardian_phone_verified_at: '2026-01-01T00:00:00.000Z',
      }
    )

    expect(status).toEqual({
      requiresGuardian: true,
      missingFields: [],
      complete: true,
    })
  })
})
