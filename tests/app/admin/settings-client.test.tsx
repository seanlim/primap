import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SettingsClient } from '@/app/(app)/admin/settings/settings-client'
import { updateSettings } from '@/lib/actions/admin-round-actions'

vi.mock('@/lib/actions/admin-round-actions', () => ({ updateSettings: vi.fn(async () => ({ success: true })) }))
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ showToast: vi.fn() }) }))

const settings = {
  requiredWalksPerRound: 4, highParticipationThreshold: 8, maxMediaPerReport: 10,
  reminderSendWeekday: 3, reminderSendTime: '13:00',
  reminderWindowStartOffsetDays: 2, reminderWindowLengthDays: 7,
}
beforeEach(() => vi.clearAllMocks())

it('shows hour and AM/PM selectors with fixed minutes and the requested notes', () => {
  const { container } = render(<SettingsClient settings={settings} />)
  expect(screen.getByRole('combobox', { name: 'Reminder hour' })).toHaveValue('1')
  expect(screen.getByRole('combobox', { name: 'AM or PM' })).toHaveValue('PM')
  expect(screen.getByText(':00')).toBeInTheDocument()
  expect(container.querySelector('input[type=time]')).toBeNull()
  expect(screen.getByText('Time in Singapore when the reminder batch is sent for both upcoming walks and pending report submission.')).toBeInTheDocument()
  expect(screen.getByText('Weekly day when reminder batches are sent for upcoming walks based on Singapore time.')).toBeInTheDocument()
})

it.each([
  ['12', 'AM', '00:00'], ['12', 'PM', '12:00'], ['9', 'PM', '21:00'],
])('saves %s %s as %s', async (hour, period, expected) => {
  render(<SettingsClient settings={settings} />)
  fireEvent.change(screen.getByRole('combobox', { name: 'Reminder hour' }), { target: { value: hour } })
  fireEvent.change(screen.getByRole('combobox', { name: 'AM or PM' }), { target: { value: period } })
  fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }))
  await waitFor(() => expect(updateSettings).toHaveBeenCalledWith(expect.objectContaining({ reminderSendTime: expected })))
})
