import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const { mockSaveSlotAttendance } = vi.hoisted(() => ({
  mockSaveSlotAttendance: vi.fn(),
}))

vi.mock('@/lib/actions/attendance-actions', () => ({
  saveSlotAttendance: mockSaveSlotAttendance,
}))

import { SlotAttendanceCard, type AttendanceMember } from '@/components/report/slot-attendance-card'

const members: AttendanceMember[] = [
  {
    userId: 'alice',
    fullName: 'Alice',
    email: 'alice@example.com',
    attendance: 'PRESENT',
    attendanceMarkedAt: '2026-11-05T02:00:00Z',
  },
  {
    userId: 'bob',
    fullName: 'Bob',
    email: 'bob@example.com',
    attendance: null,
    attendanceMarkedAt: null,
  },
]

beforeEach(() => {
  mockSaveSlotAttendance.mockReset()
  mockSaveSlotAttendance.mockResolvedValue({ success: true })
})

describe('SlotAttendanceCard', () => {
  it('saves a single volunteer correction when a checkbox is toggled', async () => {
    const user = userEvent.setup()
    render(<SlotAttendanceCard slotId="slot-1" members={members} canEdit />)

    await user.click(screen.getByRole('checkbox', { name: 'Bob attended' }))

    expect(mockSaveSlotAttendance).toHaveBeenCalledWith('slot-1', [
      { userId: 'bob', status: 'ABSENT' },
    ])
    expect(screen.getByRole('checkbox', { name: 'Bob attended' })).toHaveAttribute('aria-checked', 'false')
  })

  it('reverts an optimistic change and shows an error when saving fails', async () => {
    const user = userEvent.setup()
    mockSaveSlotAttendance.mockResolvedValue({ error: 'You are not part of this walk.' })
    render(<SlotAttendanceCard slotId="slot-1" members={members} canEdit />)

    await user.click(screen.getByRole('checkbox', { name: 'Bob attended' }))

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: 'Bob attended' })).toHaveAttribute('aria-checked', 'true')
    })
  })

  it('renders recorded attendance read-only for viewers who cannot edit', () => {
    render(<SlotAttendanceCard slotId="slot-1" members={members} canEdit={false} />)

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.getByText('Present')).toBeInTheDocument()
    expect(screen.getByText('Not recorded')).toBeInTheDocument()
  })

  it('does not render when there are no active members', () => {
    const { container } = render(<SlotAttendanceCard slotId="slot-1" members={[]} canEdit />)
    expect(container).toBeEmptyDOMElement()
  })
})
