import type { ComponentProps } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WalkDetailClient } from '@/app/(app)/walk/[walkId]/walk-detail-client'

const mockJoinWalk = vi.fn()
const mockCancelWalk = vi.fn()
const mockSearchInviteCandidates = vi.fn()
const mockInviteVolunteerToWalk = vi.fn()
const mockCancelSlotInvitation = vi.fn()
const mockShowToast = vi.fn()

vi.mock('@/lib/actions/walk-actions', () => ({
  joinWalk: (...args: unknown[]) => mockJoinWalk(...args),
  cancelWalk: (...args: unknown[]) => mockCancelWalk(...args),
  searchInviteCandidates: (...args: unknown[]) => mockSearchInviteCandidates(...args),
  inviteVolunteerToWalk: (...args: unknown[]) => mockInviteVolunteerToWalk(...args),
  cancelSlotInvitation: (...args: unknown[]) => mockCancelSlotInvitation(...args),
  respondToSlotInvitation: vi.fn(),
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}))

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function renderWalkDetail(overrides: Partial<ComponentProps<typeof WalkDetailClient>> = {}) {
  return render(
    <WalkDetailClient
      walk={{
        id: 'slot-1',
        locationName: 'Bukit Timah',
        walkDate: '2099-04-15',
        startTime: '08:00',
        endTime: '10:00',
        maxVolunteers: 3,
        notes: null,
        roundName: 'Round A',
        joinBlockedInfo: null,
      }}
      members={[]}
      pendingInvitations={[]}
      currentUserPendingInvitation={null}
      isJoined={false}
      isFull={false}
      reservedCount={0}
      canInvite={false}
      currentUserId="user-1"
      lateCancelWarning={null}
      hasSubmittedReport={false}
      {...overrides}
    />
  )
}

describe('WalkDetailClient', () => {
  it('shows "Joining..." while join request is pending', async () => {
    const deferred = createDeferred<{ success: true }>()
    mockJoinWalk.mockReturnValueOnce(deferred.promise)

    renderWalkDetail()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Join Walk' }))
      await Promise.resolve()
    })

    expect(screen.getByRole('button', { name: 'Joining...' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel Participation' })).not.toBeInTheDocument()

    await act(async () => {
      deferred.resolve({ success: true })
      await Promise.resolve()
    })
  })

  it('shows "Cancelling..." while cancel request is pending', async () => {
    const deferred = createDeferred<{ success: true }>()
    mockCancelWalk.mockReturnValueOnce(deferred.promise)

    renderWalkDetail({
      isJoined: true,
      members: [{
        userId: 'user-1',
        fullName: 'June',
        email: 'june@example.com',
        joinedAt: '2099-04-01T08:00:00.000Z',
      }],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Cancel Participation' }))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Yes, Cancel' }))
      await Promise.resolve()
    })

    expect(screen.getByRole('button', { name: 'Cancelling...' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Join Walk' })).not.toBeInTheDocument()

    await act(async () => {
      deferred.resolve({ success: true })
      await Promise.resolve()
    })
  })

  it('shows submitted-report cancellation lock message instead of the cancel button', () => {
    renderWalkDetail({
      isJoined: true,
      hasSubmittedReport: true,
      members: [{
        userId: 'user-1',
        fullName: 'June',
        email: 'june@example.com',
        joinedAt: '2099-04-01T08:00:00.000Z',
      }],
    })

    expect(screen.getByText("You can't cancel this walk after submitting your report.")).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel Participation' })).not.toBeInTheDocument()
  })

  // Regression: clicking "Yes, Cancel" twice in rapid succession used to fire
  // two concurrent cancelWalk requests. Two-layered defense:
  //   1. UI: dialog's busy prop disables both confirm/cancel buttons mid-flight.
  //   2. Logic: a synchronous cancellingRef gate in confirmCancel prevents
  //      the underlying server action from firing twice even if the button's
  //      disabled state is bypassed (e.g., keyboard event, browser quirk).
  it('disables the cancel-confirm button while a cancellation is in flight', async () => {
    // Reset mock state — other tests in this file share mockCancelWalk and
    // there's no beforeEach(clearAllMocks) at the top level.
    mockCancelWalk.mockClear()

    const deferred = createDeferred<{ success: true }>()
    mockCancelWalk.mockReturnValueOnce(deferred.promise)

    renderWalkDetail({
      isJoined: true,
      members: [{
        userId: 'user-1',
        fullName: 'June',
        email: 'june@example.com',
        joinedAt: '2099-04-01T08:00:00.000Z',
      }],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Cancel Participation' }))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Yes, Cancel' }))
      await Promise.resolve()
    })

    // Both confirm and cancel buttons inside the dialog are disabled while
    // the cancel request is mid-flight, blocking double-clicks at the UI layer.
    expect(screen.getByRole('button', { name: 'Yes, Cancel' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Keep' })).toBeDisabled()
    // The first click correctly fired exactly one cancelWalk call.
    expect(mockCancelWalk).toHaveBeenCalledTimes(1)

    await act(async () => {
      deferred.resolve({ success: true })
      await Promise.resolve()
    })
  })

  it('shows clearer blocked join status and explanation', () => {
    renderWalkDetail({
      walk: {
        id: 'slot-1',
        locationName: 'Bukit Timah',
        walkDate: '2099-04-15',
        startTime: '08:00',
        endTime: '10:00',
        maxVolunteers: 3,
        notes: null,
        roundName: 'Round A',
        joinBlockedInfo: {
          label: 'Round Closed',
          description: 'This survey round is no longer open for volunteer signup.',
        },
      },
    })

    expect(screen.getByRole('button', { name: 'Round Closed' })).toBeDisabled()
    expect(screen.getByText('This survey round is no longer open for volunteer signup.')).toBeInTheDocument()
  })

  it('shows invitation response banner for current user pending invite', () => {
    renderWalkDetail({
      pendingInvitations: [{
        id: 'invite-1',
        invitedUserId: 'user-1',
        invitedBy: 'user-2',
        inviteeName: 'June',
        inviteeEmail: 'june@example.com',
        inviterName: 'Alex',
        inviterEmail: 'alex@example.com',
        createdAt: '2099-04-01T08:00:00.000Z',
      }],
      currentUserPendingInvitation: {
        id: 'invite-1',
        invitedByName: 'Alex',
        invitedByEmail: 'alex@example.com',
      },
      reservedCount: 1,
    })

    expect(screen.getByText('Invitation pending')).toBeInTheDocument()
    expect(screen.getByText('Alex reserved a spot for you.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Join Walk' })).not.toBeInTheDocument()
  })

  it('searches candidates and sends an invitation', async () => {
    mockSearchInviteCandidates.mockResolvedValueOnce({
      candidates: [{ id: 'user-2', fullName: 'Alex', email: 'alex@example.com' }],
    })
    mockInviteVolunteerToWalk.mockResolvedValueOnce({ success: true })

    renderWalkDetail({
      isJoined: true,
      canInvite: true,
      reservedCount: 1,
      members: [{
        userId: 'user-1',
        fullName: 'June',
        email: 'june@example.com',
        joinedAt: '2099-04-01T08:00:00.000Z',
      }],
    })

    fireEvent.change(screen.getByLabelText('Search volunteers'), {
      target: { value: 'alex' },
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Search' }))
      await Promise.resolve()
    })

    expect(mockSearchInviteCandidates).toHaveBeenCalledWith('slot-1', 'alex')
    expect(screen.getByText('Alex')).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Invite' }))
      await Promise.resolve()
    })

    expect(mockInviteVolunteerToWalk).toHaveBeenCalledWith('slot-1', 'user-2')
    expect(mockShowToast).toHaveBeenCalledWith('Invitation sent to Alex.', 'success')
  })

  it('shows pending invitations and lets inviter cancel one', async () => {
    mockCancelSlotInvitation.mockResolvedValueOnce({ success: true })

    renderWalkDetail({
      isJoined: true,
      canInvite: true,
      reservedCount: 2,
      members: [{
        userId: 'user-1',
        fullName: 'June',
        email: 'june@example.com',
        joinedAt: '2099-04-01T08:00:00.000Z',
      }],
      pendingInvitations: [{
        id: 'invite-1',
        invitedUserId: 'user-2',
        invitedBy: 'user-1',
        inviteeName: 'Alex',
        inviteeEmail: 'alex@example.com',
        inviterName: 'June',
        inviterEmail: 'june@example.com',
        createdAt: '2099-04-01T08:00:00.000Z',
      }],
    })

    expect(screen.getByText('Alex')).toBeInTheDocument()
    expect(screen.getByText('Invited by June')).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
      await Promise.resolve()
    })

    expect(mockCancelSlotInvitation).toHaveBeenCalledWith('invite-1')
    expect(mockShowToast).toHaveBeenCalledWith('Invitation cancelled.', 'info')
  })
})
