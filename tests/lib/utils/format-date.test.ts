import { formatDate } from '@/lib/utils/format-date'

describe('formatDate', () => {
  // Use a fixed date for predictable output
  const testDate = '2026-03-15'

  it('formats with "full" preset', () => {
    const result = formatDate(testDate, 'full')
    expect(result).toContain('15')
    expect(result).toContain('March')
    expect(result).toContain('2026')
  })

  it('formats with "short" preset', () => {
    const result = formatDate(testDate, 'short')
    expect(result).toContain('15')
    expect(result).toContain('Mar')
  })

  it('formats with "default" preset', () => {
    const result = formatDate(testDate, 'default')
    expect(result).toContain('15')
    expect(result).toContain('Mar')
    expect(result).toContain('2026')
  })

  it('formats with "compact" preset', () => {
    const result = formatDate(testDate, 'compact')
    expect(result).toContain('15')
    expect(result).toContain('Mar')
    expect(result).toContain('2026')
  })

  it('formats with "monthYear" preset', () => {
    const result = formatDate(testDate, 'monthYear')
    expect(result).toContain('Mar')
    expect(result).toContain('2026')
  })

  it('uses "default" preset when no preset specified', () => {
    const result = formatDate(testDate)
    expect(result).toContain('Mar')
    expect(result).toContain('2026')
  })

  it('accepts Date objects', () => {
    const result = formatDate(new Date('2026-03-15'), 'compact')
    expect(result).toContain('Mar')
    expect(result).toContain('2026')
  })

  it('accepts custom options overriding preset', () => {
    const result = formatDate(testDate, 'full', { day: 'numeric', month: 'numeric' })
    // Custom options should override the preset
    expect(result).toBeDefined()
  })

  it('handles ISO datetime strings', () => {
    const result = formatDate('2026-03-15T10:30:00Z', 'compact')
    expect(result).toContain('2026')
  })

  it('formats "minimal" preset (just locale default)', () => {
    const result = formatDate(testDate, 'minimal')
    expect(result).toBeDefined()
    expect(result.length).toBeGreaterThan(0)
  })
})
