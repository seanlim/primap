import type { ComponentProps } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WalkDetailClient } from '@/app/(app)/walk/[walkId]/walk-detail-client'

const mockJoinWalk = vi.fn()
const mockCancelWalk = vi.fn()
const mockShowToast = vi.fn()

vi.mock('@/lib/actions/walk-actions', () => ({
  joinWalk: (...args: unknown[]) => mockJoinWalk(...args),
  cancelWalk: (...args: unknown[]) => mockCancelWalk(...args),
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
  const completeRoundRequirement = {
    roundId: 'round-1',
    formUrl: 'https://example.com/form',
    requiresGuardian: false,
    complete: true,
    missingFields: [],
    indemnityAcknowledgedAt: '2026-01-01T00:00:00.000Z',
    guardianName: null,
    guardianEmail: null,
    guardianEmailVerifiedAt: null,
    guardianPhoneNumber: null,
    guardianPhoneVerifiedAt: null,
  }

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
      roundRequirement={completeRoundRequirement}
      isJoined={false}
      isFull={false}
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
        phoneNumber: null,
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
        phoneNumber: null,
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
        phoneNumber: null,
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

  it('blocks joining until round requirements are complete', () => {
    renderWalkDetail({
      roundRequirement: {
        roundId: 'round-1',
        formUrl: 'https://example.com/form',
        requiresGuardian: false,
        complete: false,
        missingFields: ['indemnity_acknowledgement'],
        indemnityAcknowledgedAt: null,
        guardianName: null,
        guardianEmail: null,
        guardianEmailVerifiedAt: null,
        guardianPhoneNumber: null,
        guardianPhoneVerifiedAt: null,
      },
    })

    expect(screen.getByRole('button', { name: 'Complete Requirements' })).toBeDisabled()
    expect(screen.getByText('Round requirements')).toBeInTheDocument()
  })
})
