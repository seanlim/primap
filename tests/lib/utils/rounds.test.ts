import { findCurrentRound, findOverlappingRound, isDateInRound } from '@/lib/utils/rounds'

describe('round utilities', () => {
  const rounds = [
    { id: 'round-1', name: 'Round 1', start_date: '2026-03-01', end_date: '2026-03-31' },
    { id: 'round-2', name: 'Round 2', start_date: '2026-04-01', end_date: '2026-04-30' },
  ]

  it('identifies whether a date falls within a round', () => {
    expect(isDateInRound(rounds[0], new Date('2026-03-15T12:00:00+08:00'))).toBe(true)
    expect(isDateInRound(rounds[0], new Date('2026-04-01T12:00:00+08:00'))).toBe(false)
  })

  it('returns the round whose date range contains today', () => {
    expect(findCurrentRound(rounds, new Date('2026-04-15T12:00:00+08:00'))).toMatchObject({
      id: 'round-2',
      name: 'Round 2',
    })
  })

  it('returns null when there is no current round', () => {
    expect(findCurrentRound(rounds, new Date('2026-05-15T12:00:00+08:00'))).toBeNull()
  })

  it('finds inclusive date-range overlaps', () => {
    expect(
      findOverlappingRound(rounds, {
        start_date: '2026-03-31',
        end_date: '2026-04-10',
      })
    ).toMatchObject({ id: 'round-1' })
  })

  it('ignores the current round when checking overlaps during updates', () => {
    expect(
      findOverlappingRound(
        rounds,
        {
          start_date: '2026-04-05',
          end_date: '2026-04-25',
        },
        'round-2'
      )
    ).toBeNull()
  })
})
