// Default values for app_settings, used as fallbacks when the row is missing
// or a column is null. Range bounds match the validation in
// `lib/actions/admin-round-actions.ts#updateSettings` and the HTML min/max
// attributes in `app/(app)/admin/settings/settings-client.tsx`.

export const DEFAULT_REQUIRED_WALKS_PER_ROUND = 4
export const DEFAULT_MAX_MEDIA_PER_REPORT = 10
export const DEFAULT_HIGH_PARTICIPATION_THRESHOLD = 8
export const DEFAULT_REMINDER_SEND_WEEKDAY = 3
export const DEFAULT_REMINDER_SEND_TIME = '13:00:00'
export const DEFAULT_REMINDER_WINDOW_START_OFFSET_DAYS = 2
export const DEFAULT_REMINDER_WINDOW_LENGTH_DAYS = 7

export const REQUIRED_WALKS_PER_ROUND_RANGE = { min: 1, max: 20 } as const
export const MAX_MEDIA_PER_REPORT_RANGE = { min: 1, max: 50 } as const
export const HIGH_PARTICIPATION_THRESHOLD_RANGE = { min: 1, max: 100 } as const
export const REMINDER_SEND_WEEKDAY_RANGE = { min: 0, max: 6 } as const
export const REMINDER_WINDOW_START_OFFSET_DAYS_RANGE = { min: 0, max: 30 } as const
export const REMINDER_WINDOW_LENGTH_DAYS_RANGE = { min: 1, max: 30 } as const
