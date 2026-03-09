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

export function formatDate(
  date: string | Date,
  preset: DatePreset = 'default',
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString(LOCALE, options ?? PRESETS[preset])
}
