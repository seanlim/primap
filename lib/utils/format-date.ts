const LOCALE = 'en-SG'

const PRESETS = {
  full: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' } as const,
  short: { weekday: 'short', day: 'numeric', month: 'short' } as const,
  default: { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' } as const,
  compact: { day: 'numeric', month: 'short', year: 'numeric' } as const,
  monthYear: { month: 'short', year: 'numeric' } as const,
  minimal: {} as Intl.DateTimeFormatOptions,
}

export type DatePreset = keyof typeof PRESETS

/** Returns local YYYY-MM-DD string without UTC conversion. */
export function toLocalDateString(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** Returns a relative label like "Today", "Tomorrow", or "in 3 days". */
export function getRelativeDay(dateStr: string): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  target.setHours(0, 0, 0, 0)
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays > 1) return `in ${diffDays} days`
  return ''
}

export function formatDate(
  date: string | Date,
  preset: DatePreset = 'default',
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString(LOCALE, options ?? PRESETS[preset])
}
