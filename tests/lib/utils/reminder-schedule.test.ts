// @vitest-environment node
import { getReminderCoverageWindow } from '@/lib/utils/reminder-schedule'

it('calculates the weekly window in Singapore even when the server runs in UTC', () => {
  const before = process.env.TZ
  process.env.TZ = 'UTC'
  try {
    expect(getReminderCoverageWindow(new Date('2026-10-28T05:00:00Z'), {
      reminderSendWeekday: 3, reminderSendTime: '13:00:00',
      reminderWindowStartOffsetDays: 2, reminderWindowLengthDays: 7,
    })).toEqual({ scheduledAt: new Date('2026-10-28T05:00:00Z'), startDate: '2026-10-30', endDate: '2026-11-05' })
  } finally {
    if (before === undefined) delete process.env.TZ
    else process.env.TZ = before
  }
})
