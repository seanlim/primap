import { createClient } from '@/lib/supabase/server'
import { SettingsClient } from './settings-client'
import {
  DEFAULT_HIGH_PARTICIPATION_THRESHOLD,
  DEFAULT_MAX_MEDIA_PER_REPORT,
  DEFAULT_REMINDER_SEND_TIME,
  DEFAULT_REMINDER_SEND_WEEKDAY,
  DEFAULT_REMINDER_WINDOW_LENGTH_DAYS,
  DEFAULT_REMINDER_WINDOW_START_OFFSET_DAYS,
  DEFAULT_REQUIRED_WALKS_PER_ROUND,
} from '@/lib/constants/settings'
import { formatReminderTimeForInput } from '@/lib/utils/reminder-schedule'

export const dynamic = 'force-dynamic'

export default async function AdminSettingsPage() {
  const supabase = await createClient()

  const { data: settings } = await supabase
    .from('app_settings')
    .select('*')
    .limit(1)
    .single()

  return (
    <SettingsClient
      settings={{
        requiredWalksPerRound: settings?.required_walks_per_round ?? DEFAULT_REQUIRED_WALKS_PER_ROUND,
        highParticipationThreshold: settings?.high_participation_threshold ?? DEFAULT_HIGH_PARTICIPATION_THRESHOLD,
        maxMediaPerReport: settings?.max_media_per_report ?? DEFAULT_MAX_MEDIA_PER_REPORT,
        reminderSendWeekday: settings?.reminder_send_weekday ?? DEFAULT_REMINDER_SEND_WEEKDAY,
        reminderSendTime: formatReminderTimeForInput(settings?.reminder_send_time ?? DEFAULT_REMINDER_SEND_TIME),
        reminderWindowStartOffsetDays:
          settings?.reminder_window_start_offset_days ?? DEFAULT_REMINDER_WINDOW_START_OFFSET_DAYS,
        reminderWindowLengthDays:
          settings?.reminder_window_length_days ?? DEFAULT_REMINDER_WINDOW_LENGTH_DAYS,
      }}
    />
  )
}
