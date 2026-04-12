import { toLocalDateString } from '@/lib/utils/format-date'

export interface RoundDateRange {
  id?: string | null
  name?: string | null
  start_date: string
  end_date: string
}

export function isDateInRound(round: Pick<RoundDateRange, 'start_date' | 'end_date'>, now: Date) {
  const today = toLocalDateString(now)
  return round.start_date <= today && today <= round.end_date
}

export function findCurrentRound<T extends RoundDateRange>(rounds: T[], now: Date = new Date()) {
  return rounds.find((round) => isDateInRound(round, now)) ?? null
}

export function findOverlappingRound<T extends RoundDateRange>(
  rounds: T[],
  candidate: Pick<RoundDateRange, 'start_date' | 'end_date'>,
  excludeRoundId?: string
) {
  return rounds.find((round) => {
    if (excludeRoundId && round.id === excludeRoundId) return false
    return round.start_date <= candidate.end_date && candidate.start_date <= round.end_date
  }) ?? null
}
