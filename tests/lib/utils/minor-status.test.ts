import { describe, expect, it } from 'vitest'
import { isMinorAtRoundStart, normalizeBirthMonth } from '@/lib/utils/minor-status'

describe('minor status helpers', () => {
  it('normalizes a month value to the first day', () => {
    expect(normalizeBirthMonth('2008-07')).toBe('2008-07-01')
  })

  it('rejects malformed and future birth months', () => {
    expect(normalizeBirthMonth('2008-13')).toBeNull()
    expect(normalizeBirthMonth('2008-7')).toBeNull()
    const nextYear = `${new Date().getFullYear() + 1}-01`
    expect(normalizeBirthMonth(nextYear)).toBeNull()
  })

  it('keeps a volunteer a minor through their 18th birthday month', () => {
    expect(isMinorAtRoundStart('2008-07-01', '2026-06-01')).toBe(true)
    expect(isMinorAtRoundStart('2008-07-01', '2026-07-01')).toBe(true)
    expect(isMinorAtRoundStart('2008-07-01', '2026-08-01')).toBe(false)
  })

  it('treats missing or invalid data as not determinably minor', () => {
    expect(isMinorAtRoundStart(null, '2026-01-01')).toBe(false)
    expect(isMinorAtRoundStart('not-a-date', '2026-01-01')).toBe(false)
  })
})
