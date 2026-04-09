import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UsersClient } from '@/app/(app)/admin/users/users-client'

vi.mock('@/lib/actions/admin-user-actions', () => ({
  approveUser: vi.fn(),
  rejectUser: vi.fn(),
  disableUser: vi.fn(),
  enableUser: vi.fn(),
  setUserRole: vi.fn(),
}))

describe('UsersClient admin indicators', () => {
  const defaultProps = {
    users: [
      {
        id: 'user-1',
        email: 'active@example.com',
        fullName: 'Active Reporter',
        role: 'VOLUNTEER' as const,
        status: 'ACTIVE' as const,
        createdAt: '2026-04-01T00:00:00.000Z',
      },
      {
        id: 'user-2',
        email: 'late@example.com',
        fullName: 'Late Canceller',
        role: 'VOLUNTEER' as const,
        status: 'ACTIVE' as const,
        createdAt: '2026-04-02T00:00:00.000Z',
      },
    ],
    currentPage: 1,
    totalCount: 2,
    pageSize: 50,
    statusCounts: { PENDING: 0, ACTIVE: 2, REJECTED: 0, DISABLED: 0 },
    activeFilter: null,
    analytics: {
      userStats: {
        'user-1': {
          participations: 8,
          submissions: 8,
          cancellations: 0,
          lateCancellations: 0,
          hasHighParticipationIndicator: true,
          hasLateCancellationIndicator: false,
        },
        'user-2': {
          participations: 1,
          submissions: 0,
          cancellations: 3,
          lateCancellations: 2,
          hasHighParticipationIndicator: false,
          hasLateCancellationIndicator: true,
        },
      },
    },
  }

  it('renders high and late indicators in the activity row', () => {
    render(
      <UsersClient {...defaultProps} />
    )

    expect(screen.getByText('High')).toBeInTheDocument()
    expect(screen.getByText('Late (2)')).toBeInTheDocument()
  })

  it('filters by high participation or late cancellation indicators', async () => {
    const user = userEvent.setup()
    render(<UsersClient {...defaultProps} />)

    const indicatorFilter = screen.getByLabelText('Indicator')

    await user.selectOptions(indicatorFilter, 'HIGH')
    expect(screen.getByText('Active Reporter')).toBeInTheDocument()
    expect(screen.queryByText('Late Canceller')).not.toBeInTheDocument()

    await user.selectOptions(indicatorFilter, 'LATE')
    expect(screen.queryByText('Active Reporter')).not.toBeInTheDocument()
    expect(screen.getByText('Late Canceller')).toBeInTheDocument()
  })
})
