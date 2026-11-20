/**
 * Converts a YYYY-MM form value into the first day of that month, matching the
 * database's month-only birth-date representation.
 */
export function normalizeBirthMonth(value: string): string | null {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value.trim())
  if (!match) return null

  const candidate = `${match[1]}-${match[2]}-01`
  if (candidate > new Date().toISOString().slice(0, 7) + '-01') return null
  return candidate
}

/**
 * The database stores month/year only. Keep a volunteer under the guardian
 * policy through their 18th birthday month; they become an adult next month.
 */
export function isMinorAtRoundStart(
  birthMonth: string | null | undefined,
  roundStartDate: string | null | undefined
): boolean {
  if (!birthMonth || !roundStartDate) return false

  const birth = /^(\d{4})-(\d{2})/.exec(birthMonth)
  const round = /^(\d{4})-(\d{2})/.exec(roundStartDate)
  if (!birth || !round) return false

  const adultMonthYear = Number(birth[1]) + 18
  const adultMonth = `${adultMonthYear}-${birth[2]}`
  const roundMonth = `${round[1]}-${round[2]}`
  return roundMonth <= adultMonth
}
