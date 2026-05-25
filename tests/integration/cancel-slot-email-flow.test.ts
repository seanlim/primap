/**
 * Integration test: Server actions -> real email module -> mocked Resend
 *
 * Only external boundaries are mocked:
 *   1. @/lib/supabase/server  (database)
 *   2. resend                 (email API)
 *
 * The real @/lib/email module wires through naturally.
 */

const { mockSend, mockSingle, mockChain, mockSupabase } = vi.hoisted(() => {
  const mockSend = vi.fn().mockResolvedValue({})
  const mockSingle = vi.fn()
  const mockChain = {
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    single: mockSingle,
  }
  const mockSupabase = {
    from: vi.fn().mockReturnValue(mockChain),
    rpc: vi.fn(),
    storage: {
      from: vi.fn().mockReturnValue({
        remove: vi.fn().mockResolvedValue({ error: null }),
      }),
    },
    auth: {
      getUser: vi.fn(),
    },
  }
  return { mockSend, mockSingle, mockChain, mockSupabase }
})

vi.mock('resend', () => ({
  Resend: class MockResend {
    emails = { send: mockSend }
  },
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabase),
}))

import { cancelWalk } from '@/lib/actions/walk-actions'
import {
  approveUser,
  rejectUser,
  disableUser,
  enableUser,
} from '@/lib/actions/admin-user-actions'
import { sendWalkCancellationEmail } from '@/lib/email'

function resetChain() {
  mockChain.select.mockReturnThis()
  mockChain.update.mockReturnThis()
  mockChain.insert.mockReturnThis()
  mockChain.eq.mockReturnThis()
  mockChain.neq.mockReturnThis()
  mockSingle.mockReset()
  mockSupabase.from.mockReturnValue(mockChain)
  mockSupabase.rpc.mockResolvedValue({
    data: { success: true, deleted_draft_count: 0, file_paths: [] },
    error: null,
  })
  mockSupabase.storage.from.mockReturnValue({
    remove: vi.fn().mockResolvedValue({ error: null }),
  })
}

describe('cancel-walk-email-flow (integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetChain()
    mockSend.mockReset()
    mockSend.mockResolvedValue({})
    process.env.RESEND_API_KEY = 'test-key'
  })

  // ---- cancelWalk -> sendWalkCancellationEmail -> Resend ----

  it('cancelWalk sends cancellation email to other slot members via real email module', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    })

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'slot_memberships') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                neq: vi.fn().mockResolvedValue({
                  data: [
                    { user_id: 'user-2', profiles: { email: 'bob@test.com' } },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'walk_slots') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { walk_date: '2026-04-01', start_time: '08:00', location_name: 'Bukit Timah' },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { full_name: 'Alice', email: 'alice@test.com' },
                error: null,
              }),
            }),
          }),
        }
      }
      return mockChain
    })

    const result = await cancelWalk('slot-1')

    expect(result).toEqual({ success: true })
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Walk Cancellation Update',
        to: 'bob@test.com',
      }),
    )
  })

  it('cancelWalk with no other members does not send email', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    })

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'slot_memberships') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                neq: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        }
      }
      if (table === 'walk_slots') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { walk_date: '2026-04-01', start_time: '08:00', location_name: 'Bukit Timah' },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { full_name: 'Alice', email: 'alice@test.com' },
                error: null,
              }),
            }),
          }),
        }
      }
      return mockChain
    })

    const result = await cancelWalk('slot-1')

    expect(result).toEqual({ success: true })
    expect(mockSend).not.toHaveBeenCalled()
  })

  // TC-INT-CANCEL-01 (UC-04): Cancellation should succeed even if email provider fails
  it('cancelWalk still succeeds when Resend.send throws (email error is swallowed)', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    })

    mockSend.mockRejectedValue(new Error('Resend API down'))

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'slot_memberships') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                neq: vi.fn().mockResolvedValue({
                  data: [
                    { user_id: 'user-2', profiles: { email: 'bob@test.com' } },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'walk_slots') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { walk_date: '2026-04-01', start_time: '08:00', location_name: 'Bukit Timah' },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { full_name: 'Alice', email: 'alice@test.com' },
                error: null,
              }),
            }),
          }),
        }
      }
      return mockChain
    })

    const result = await cancelWalk('slot-1')

    // Action succeeds even though the email failed
    expect(result).toEqual({ success: true })
    expect(mockSend).toHaveBeenCalled()
  })

  // ---- Admin actions -> real email module -> Resend ----

  function setupAdminChain(updatedProfile: { email: string; full_name: string | null }, options?: { approve?: boolean }) {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'admin-1' } },
    })
    mockSingle.mockResolvedValueOnce({ data: { role: 'ADMIN' }, error: null })

    if (options?.approve) {
      mockSingle.mockResolvedValueOnce({
        data: {
          phone_number: '+6591234567',
          phone_verified_at: '2026-01-01T00:00:00.000Z',
          date_of_birth: '1990-01-01',
          guardian_phone_number: null,
          guardian_phone_verified_at: null,
        },
        error: null,
      })
    }

    mockSingle.mockResolvedValueOnce({ data: updatedProfile, error: null })
  }

  // TC-INT-ADMIN-01 (UC-13): Approval flow triggers account-approved email side effect
  it('approveUser -> sendAccountApprovedEmail -> Resend.send with correct subject', async () => {
    setupAdminChain({ email: 'user@test.com', full_name: 'Test User' }, { approve: true })

    const result = await approveUser('user-2')

    expect(result).toEqual({ success: true })
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Primap Account Approved',
        to: 'user@test.com',
      }),
    )
  })

  it('rejectUser -> sendAccountRejectedEmail -> Resend.send with correct subject', async () => {
    setupAdminChain({ email: 'user@test.com', full_name: 'Test User' })

    const result = await rejectUser('user-2')

    expect(result).toEqual({ success: true })
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Primap Account Update',
        to: 'user@test.com',
      }),
    )
  })

  it('disableUser -> sendAccountDisabledEmail -> Resend.send with correct subject', async () => {
    setupAdminChain({ email: 'user@test.com', full_name: 'Test User' })

    const result = await disableUser('user-2')

    expect(result).toEqual({ success: true })
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Primap Account Disabled',
        to: 'user@test.com',
      }),
    )
  })

  it('enableUser -> sendAccountEnabledEmail -> Resend.send with correct subject', async () => {
    setupAdminChain({ email: 'user@test.com', full_name: 'Test User' })

    const result = await enableUser('user-2')

    expect(result).toEqual({ success: true })
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Primap Account Re-enabled',
        to: 'user@test.com',
      }),
    )
  })

  it('sendWalkCancellationEmail with multiple recipients -> multiple Resend.send calls', async () => {
    await sendWalkCancellationEmail(
      ['a@test.com', 'b@test.com', 'c@test.com'],
      { date: '2026-04-01', time: '08:00', location: 'Bukit Timah' },
      'Alice',
    )

    expect(mockSend).toHaveBeenCalledTimes(3)
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'a@test.com', subject: 'Walk Cancellation Update' }),
    )
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'b@test.com', subject: 'Walk Cancellation Update' }),
    )
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'c@test.com', subject: 'Walk Cancellation Update' }),
    )
  })
})
