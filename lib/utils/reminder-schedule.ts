import {
  DEFAULT_REMINDER_SEND_TIME,
  DEFAULT_REMINDER_SEND_WEEKDAY,
  DEFAULT_REMINDER_WINDOW_LENGTH_DAYS,
  DEFAULT_REMINDER_WINDOW_START_OFFSET_DAYS,
} from '@/lib/constants/settings'
import { APP_TIME_ZONE_OFFSET, getAppDateString } from '@/lib/utils/walk-participation'

export interface ReminderScheduleSettings {
  reminderSendWeekday?: number | null
  reminderSendTime?: string | null
  reminderWindowStartOffsetDays?: number | null
  reminderWindowLengthDays?: number | null
}

export interface ReminderCoverageWindow {
  scheduledAt: Date
  startDate: string
  endDate: string
}

function normalizeReminderTime(value?: string | null) {
  const source = value?.trim() || DEFAULT_REMINDER_SEND_TIME
  if (/^\d{2}:\d{2}$/.test(source)) return `${source}:00`
  return /^\d{2}:\d{2}:\d{2}$/.test(source) ? source : DEFAULT_REMINDER_SEND_TIME
}

function getScheduleConfig(settings?: ReminderScheduleSettings | null) {
  return {
    reminderSendWeekday: settings?.reminderSendWeekday ?? DEFAULT_REMINDER_SEND_WEEKDAY,
    reminderSendTime: normalizeReminderTime(settings?.reminderSendTime),
    reminderWindowStartOffsetDays:
      settings?.reminderWindowStartOffsetDays ?? DEFAULT_REMINDER_WINDOW_START_OFFSET_DAYS,
    reminderWindowLengthDays:
      settings?.reminderWindowLengthDays ?? DEFAULT_REMINDER_WINDOW_LENGTH_DAYS,
  }
}

function parseAppDate(date: string) {
  return new Date(`${date}T00:00:00${APP_TIME_ZONE_OFFSET}`)
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function toAppDateString(date: Date) {
  return getAppDateString(date)
}

export function getMostRecentReminderScheduleTime(
  now = new Date(),
  settings?: ReminderScheduleSettings | null
) {
  const config = getScheduleConfig(settings)
  const nowDateString = getAppDateString(now)
  const today = parseAppDate(nowDateString)
  const currentWeekday = today.getDay()
  const daysSinceReminderDay =
    (currentWeekday - config.reminderSendWeekday + 7) % 7

  let scheduledDate = addDays(today, -daysSinceReminderDay)
  let scheduledAt = new Date(
    `${toAppDateString(scheduledDate)}T${config.reminderSendTime}${APP_TIME_ZONE_OFFSET}`
  )

  if (now < scheduledAt) {
    scheduledDate = addDays(scheduledDate, -7)
    scheduledAt = new Date(
      `${toAppDateString(scheduledDate)}T${config.reminderSendTime}${APP_TIME_ZONE_OFFSET}`
    )
  }

  return scheduledAt
}

export function getReminderCoverageWindow(
  now = new Date(),
  settings?: ReminderScheduleSettings | null
): ReminderCoverageWindow {
  const config = getScheduleConfig(settings)
  const scheduledAt = getMostRecentReminderScheduleTime(now, settings)
  const scheduledDate = parseAppDate(getAppDateString(scheduledAt))
  const windowStart = addDays(scheduledDate, config.reminderWindowStartOffsetDays)
  const windowEnd = addDays(windowStart, config.reminderWindowLengthDays - 1)

  return {
    scheduledAt,
    startDate: toAppDateString(windowStart),
    endDate: toAppDateString(windowEnd),
  }
}

export function hasReminderScheduleElapsed(
  now = new Date(),
  settings?: ReminderScheduleSettings | null
) {
  return now >= getMostRecentReminderScheduleTime(now, settings)
}

export function isLateCancellationActive(reminderSentAt?: string | null) {
  return Boolean(reminderSentAt)
}

export function formatReminderTimeForInput(value?: string | null) {
  return normalizeReminderTime(value).slice(0, 5)
}
