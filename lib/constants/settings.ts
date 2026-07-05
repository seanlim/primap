// Default values for app_settings, used as fallbacks when the row is missing
// or a column is null. Range bounds match the validation in
// `lib/actions/admin-round-actions.ts#updateSettings` and the HTML min/max
// attributes in `app/(app)/admin/settings/settings-client.tsx`.

export const DEFAULT_REQUIRED_WALKS_PER_ROUND = 4
export const DEFAULT_LATE_CANCEL_HOURS = 48
export const DEFAULT_MAX_MEDIA_PER_REPORT = 10
export const DEFAULT_HIGH_PARTICIPATION_THRESHOLD = 8
export const DEFAULT_INDEMNITY_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSeyEo0vrWJVWliNvA5Q9xaz1CX7dimhJlRYUbojbbLO9ewtBQ/viewform'

export const REQUIRED_WALKS_PER_ROUND_RANGE = { min: 1, max: 20 } as const
export const LATE_CANCEL_HOURS_RANGE = { min: 1, max: 168 } as const
export const MAX_MEDIA_PER_REPORT_RANGE = { min: 1, max: 50 } as const
export const HIGH_PARTICIPATION_THRESHOLD_RANGE = { min: 1, max: 100 } as const
