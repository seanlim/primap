import { describe, expect, it } from 'vitest'
import {
  formatPhoneForDisplay,
  hasPhone,
  normalizePhone,
  PHONE_INVALID_MESSAGE,
  PHONE_REQUIRED_MESSAGE,
} from '@/lib/utils/phone'

describe('normalizePhone', () => {
  it.each([
    ['91234567', '+6591234567'],
    ['9123 4567', '+6591234567'],
    ['9123-4567', '+6591234567'],
    ['(912) 345-67', '+6591234567'],
    ['6591234567', '+6591234567'],
    ['+65 9123 4567', '+6591234567'],
    ['+65-9123-4567', '+6591234567'],
    ['+1 415 555 0132', '+14155550132'],
    ['  +44 20 7946 0958  ', '+442079460958'],
  ])('normalises %s to %s', (input, expected) => {
    expect(normalizePhone(input)).toEqual({ ok: true, e164: expected })
  })

  it.each(['61234567', '31234567', '81234567', '91234567'])(
    'accepts Singapore number %s',
    (input) => {
      expect(normalizePhone(input).ok).toBe(true)
    }
  )

  it.each(['', '   ', null, undefined])('requires a value for %j', (input) => {
    expect(normalizePhone(input)).toEqual({ ok: false, error: PHONE_REQUIRED_MESSAGE })
  })

  it.each(['12345', '12345678', '71234567', 'not a phone', '+', '+1234'])(
    'rejects %s',
    (input) => {
      expect(normalizePhone(input)).toEqual({ ok: false, error: PHONE_INVALID_MESSAGE })
    }
  )
})

describe('formatPhoneForDisplay', () => {
  it('formats Singapore numbers with a country code and spacing', () => {
    expect(formatPhoneForDisplay('+6591234567')).toBe('+65 9123 4567')
  })

  it('leaves international numbers untouched', () => {
    expect(formatPhoneForDisplay('+14155550132')).toBe('+14155550132')
  })

  it('handles blank values', () => {
    expect(formatPhoneForDisplay(null)).toBe('')
  })
})

describe('hasPhone', () => {
  it('treats blank values as missing', () => {
    expect(hasPhone(null)).toBe(false)
    expect(hasPhone('   ')).toBe(false)
  })

  it('accepts stored numbers', () => {
    expect(hasPhone('+6591234567')).toBe(true)
  })
})
