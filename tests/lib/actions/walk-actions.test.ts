import { revalidatePath } from 'next/cache'

const { mockSupabase, methods } = vi.hoisted(() => {
  const methods = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    upsert: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    in: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    rpc: vi.fn(),
  }
  for (const key of Object.keys(methods) as (keyof typeof methods)[]) {
    if (key !== 'single' && key !== 'maybeSingle' && key !== 'rpc') methods[key].mockReturnThis()
  }
  const mockSupabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
    storage: {
      from: vi.fn(),
    },
    from: vi.fn().mockReturnValue(methods),
    rpc: vi.fn(),
  }
  return { mockSupabase, methods }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mockSupabase),
}))

vi.mock('@/lib/email', () => ({
  sendWalkCancellationEmail: vi.fn(),
  sendWalkInvitationEmail: vi.fn(),
}))

import {
  joinWalk,
  cancelWalk,
  searchInviteCandidates,
  inviteVolunteerToWalk,
  respondToSlotInvitation,
  cancelSlotInvitation,
} from '@/lib/actions/walk-actions'
import { sendWalkCancellationEmail, sendWalkInvitationEmail } from '@/lib/email'

function resetChain() {
  methods.select.mockReturnThis()
  methods.insert.mockReturnThis()
  methods.update.mockReturnThis()
  methods.delete.mockReturnThis()
  methods.upsert.mockReturnThis()
  methods.eq.mockReturnThis()
  methods.neq.mockReturnThis()
  methods.in.mockReturnThis()
  methods.limit.mockReturnThis()
  methods.maybeSingle.mockResolvedValue({ data: null, error: null })
  methods.single.mockResolvedValue({ data: null, error: null })
  mockSupabase.rpc.mockResolvedValue({ data: null, error: null })
  mockSupabase.from.mockReturnValue(methods)
  mockSupabase.storage.from.mockReturnValue({
    remove: vi.fn().mockResolvedValue({ error: null }),
  })
}

function setupUser(userId = 'user-1') {
  mockSupabase.auth.getUser.mockResolvedValue({
    data: { user: { id: userId } },
  })
}

function mockJoinableSlot(overrides?: Partial<{
  walk_date: string
  start_time: string
  max_volunteers: number
  survey_rounds: { status: string }
  slot_memberships: Array<{ user_id: string; status: string }>
  slot_invitations: Array<{ invited_user_id: string; status: string }>
}>) {
  methods.single.mockResolvedValueOnce({
    data: {
      walk_date: '2099-04-15',
      start_time: '08:00',
      max_volunteers: 3,
      survey_rounds: { status: 'OPEN' },
      slot_memberships: [],
      slot_invitations: [],
      ...overrides,
    },
    error: null,
  })
}

function setupCancelMocks(overrides?: {
  rpcResult?: {
    success?: boolean
    error?: string
    deleted_draft_count?: number
    file_paths?: string[]
  } | null
  rpcError?: { message: string } | null
  storageError?: { message: string } | null
  slot?: { walk_date: string; start_time: string; location_name: string } | null
  profile?: { full_name: string | null; email: string | null } | null
  otherMembers?: Array<{ user_id: string; profiles: { email: string | null } }>
}) {
  const rpcResult = overrides && 'rpcResult' in overrides
    ? overrides.rpcResult
    : { success: true, deleted_draft_count: 0, file_paths: [] }
  const rpcError = overrides?.rpcError ?? null
  const storageError = overrides?.storageError ?? null
  const slot = overrides && 'slot' in overrides
    ? overrides.slot
    : { walk_date: '2026-04-15', start_time: '08:00', location_name: 'Central Park' }
  const profile = overrides && 'profile' in overrides
    ? overrides.profile
    : { full_name: 'Test User', email: 'user@test.com' }
  const otherMembers = overrides && 'otherMembers' in overrides
    ? overrides.otherMembers
    : [{ user_id: 'other-1', profiles: { email: 'other@test.com' } }]

  mockSupabase.rpc.mockResolvedValue({
    data: rpcResult,
    error: rpcError,
  })
  mockSupabase.storage.from.mockReturnValue({
    remove: vi.fn().mockResolvedValue({ error: storageError }),
  })

  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'slot_memberships') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              neq: vi.fn().mockResolvedValue({
                data: otherMembers,
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
              data: slot,
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
              data: profile,
              error: null,
            }),
          }),
        }),
      }
    }

    return methods
  })
}

describe('walk-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetChain()
  })

  describe('joinWalk', () => {
    it('returns error when not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })

      const result = await joinWalk('slot-1')

      expect(result).toEqual({ error: 'Not authenticated' })
    })

    // TC-UNIT-WALK-01 (UC-03): Successful sign up for a walk slot
    it('calls RPC and returns success', async () => {
      setupUser()
      mockJoinableSlot()
      mockSupabase.rpc.mockResolvedValue({
        data: { success: true, membership_id: 'mem-1', observation_id: 'obs-1' },
        error: null,
      })

      const result = await joinWalk('slot-1')

      expect(result).toEqual({ success: true })
      expect(mockSupabase.rpc).toHaveBeenCalledWith('join_slot_with_observation', {
        p_slot_id: 'slot-1',
        p_user_id: 'user-1',
      })
      expect(revalidatePath).toHaveBeenCalledWith('/walk')
      expect(revalidatePath).toHaveBeenCalledWith('/walk/slot-1')
      expect(revalidatePath).toHaveBeenCalledWith('/home')
      expect(revalidatePath).toHaveBeenCalledWith('/report')
      expect(revalidatePath).toHaveBeenCalledWith('/report/slot-1')
      expect(revalidatePath).toHaveBeenCalledWith('/profile')
    })

    // TC-UNIT-WALK-02 (UC-03 A1): Slot full prevents sign up
    it('returns "Slot is full" before calling RPC', async () => {
      setupUser()
      mockJoinableSlot({
        max_volunteers: 1,
        slot_memberships: [{ user_id: 'other-user', status: 'ACTIVE' }],
      })

      const result = await joinWalk('slot-1')

      expect(result).toEqual({ error: 'This walk has reached its volunteer limit.' })
      expect(mockSupabase.rpc).not.toHaveBeenCalled()
    })

    it('treats pending invitations for other users as reserved capacity', async () => {
      setupUser()
      mockJoinableSlot({
        max_volunteers: 2,
        slot_memberships: [{ user_id: 'other-user', status: 'ACTIVE' }],
        slot_invitations: [{ invited_user_id: 'invited-user', status: 'PENDING' }],
      })

      const result = await joinWalk('slot-1')

      expect(result).toEqual({ error: 'This walk has reached its volunteer limit.' })
      expect(mockSupabase.rpc).not.toHaveBeenCalled()
    })

    it('does not count the current user pending invitation against their reserved join', async () => {
      setupUser()
      mockJoinableSlot({
        max_volunteers: 1,
        slot_invitations: [{ invited_user_id: 'user-1', status: 'PENDING' }],
      })
      mockSupabase.rpc.mockResolvedValue({
        data: { success: true, membership_id: 'mem-1', observation_id: 'obs-1', invitation_id: 'invite-1' },
        error: null,
      })

      const result = await joinWalk('slot-1')

      expect(result).toEqual({ success: true })
      expect(mockSupabase.rpc).toHaveBeenCalledWith('join_slot_with_observation', {
        p_slot_id: 'slot-1',
        p_user_id: 'user-1',
      })
    })

    // TC-UNIT-WALK-03 (UC-03 A2): Duplicate sign up is blocked
    it('returns "already joined" before calling RPC', async () => {
      setupUser()
      mockJoinableSlot({
        slot_memberships: [{ user_id: 'user-1', status: 'ACTIVE' }],
      })

      const result = await joinWalk('slot-1')

      expect(result).toEqual({ error: 'You have already joined this walk.' })
      expect(mockSupabase.rpc).not.toHaveBeenCalled()
    })

    it('returns generic DB error from RPC', async () => {
      setupUser()
      mockJoinableSlot()
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Unexpected error' },
      })

      const result = await joinWalk('slot-1')

      expect(result).toEqual({ error: 'Unexpected error' })
    })

    it('returns slot lookup errors before calling RPC', async () => {
      setupUser()
      methods.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Slot lookup failed' },
      })

      const result = await joinWalk('slot-1')

      expect(result).toEqual({ error: 'Slot lookup failed' })
      expect(mockSupabase.rpc).not.toHaveBeenCalled()
    })

    it('returns not found when the slot lookup has no row', async () => {
      setupUser()
      methods.single.mockResolvedValueOnce({
        data: null,
        error: null,
      })

      const result = await joinWalk('slot-1')

      expect(result).toEqual({ error: 'Walk slot not found.' })
      expect(mockSupabase.rpc).not.toHaveBeenCalled()
    })

    it('blocks joining a closed survey round', async () => {
      setupUser()
      mockJoinableSlot({
        survey_rounds: { status: 'CLOSED' },
      })

      const result = await joinWalk('slot-1')

      expect(result).toEqual({ error: 'This survey round is no longer open for volunteer signup.' })
      expect(mockSupabase.rpc).not.toHaveBeenCalled()
    })

    it('returns business errors from the join RPC', async () => {
      setupUser()
      mockJoinableSlot()
      mockSupabase.rpc.mockResolvedValue({
        data: { success: false, error: 'Database capacity guard blocked this join.' },
        error: null,
      })

      const result = await joinWalk('slot-1')

      expect(result).toEqual({ error: 'Database capacity guard blocked this join.' })
    })

    it('handles re-join after cancel (RPC reactivates membership)', async () => {
      setupUser()
      mockJoinableSlot({
        slot_memberships: [{ user_id: 'user-1', status: 'CANCELLED' }],
      })
      mockSupabase.rpc.mockResolvedValue({
        data: { success: true, membership_id: 'mem-1', observation_id: 'obs-1' },
        error: null,
      })

      const result = await joinWalk('slot-1')

      expect(result).toEqual({ success: true })
      expect(mockSupabase.rpc).toHaveBeenCalledWith('join_slot_with_observation', {
        p_slot_id: 'slot-1',
        p_user_id: 'user-1',
      })
    })
  })

  describe('slot invitations', () => {
    it('returns error when searching candidates without authentication', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })

      const result = await searchInviteCandidates('slot-1', '')

      expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('returns slot lookup errors from candidate search', async () => {
      setupUser()
      methods.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Slot read failed' },
      })

      const result = await searchInviteCandidates('slot-1', '')

      expect(result).toEqual({ error: 'Slot read failed' })
    })

    it('returns profile lookup errors from candidate search', async () => {
      setupUser()

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'walk_slots') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    slot_memberships: [{ user_id: 'user-1', status: 'ACTIVE' }],
                    slot_invitations: [],
                  },
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
                eq: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'Profile read failed' },
                  }),
                }),
              }),
            }),
          }
        }

        return methods
      })

      const result = await searchInviteCandidates('slot-1', '')

      expect(result).toEqual({ error: 'Profile read failed' })
    })

    it('searches active volunteer candidates and excludes members, pending invitees, and self', async () => {
      setupUser()

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'walk_slots') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    slot_memberships: [
                      { user_id: 'user-1', status: 'ACTIVE' },
                      { user_id: 'member-1', status: 'ACTIVE' },
                    ],
                    slot_invitations: [
                      { invited_user_id: 'pending-1', status: 'PENDING' },
                    ],
                  },
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
                eq: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [
                      { id: 'user-1', full_name: 'Self', email: 'self@test.com' },
                      { id: 'member-1', full_name: 'Member', email: 'member@test.com' },
                      { id: 'pending-1', full_name: 'Pending', email: 'pending@test.com' },
                      { id: 'candidate-1', full_name: 'Alex Tan', email: 'alex@test.com' },
                      { id: 'candidate-2', full_name: 'Bea Lim', email: 'bea@test.com' },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          }
        }

        return methods
      })

      const result = await searchInviteCandidates('slot-1', 'alex')

      expect(result).toEqual({
        candidates: [{ id: 'candidate-1', fullName: 'Alex Tan', email: 'alex@test.com' }],
      })
    })

    it('blocks invite candidate search for non-members', async () => {
      setupUser()

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'walk_slots') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    slot_memberships: [{ user_id: 'other-user', status: 'ACTIVE' }],
                    slot_invitations: [],
                  },
                  error: null,
                }),
              }),
            }),
          }
        }

        return methods
      })

      const result = await searchInviteCandidates('slot-1', '')

      expect(result).toEqual({ error: 'Only active group members can invite volunteers.' })
    })

    it('returns error when creating invitation without authentication', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })

      const result = await inviteVolunteerToWalk('slot-1', 'user-2')

      expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('returns RPC errors when creating invitations', async () => {
      setupUser()
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Invitation failed' },
      })

      const result = await inviteVolunteerToWalk('slot-1', 'user-2')

      expect(result).toEqual({ error: 'Invitation failed' })
    })

    it('returns unexpected response errors for malformed invitation RPC payloads', async () => {
      setupUser()
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: null,
      })

      const result = await inviteVolunteerToWalk('slot-1', 'user-2')

      expect(result).toEqual({ error: 'Unexpected invitation response.' })
    })

    it('returns business errors from the invitation RPC', async () => {
      setupUser()
      mockSupabase.rpc.mockResolvedValue({
        data: { success: false, error: 'This volunteer is already invited.' },
        error: null,
      })

      const result = await inviteVolunteerToWalk('slot-1', 'user-2')

      expect(result).toEqual({ error: 'This volunteer is already invited.' })
    })

    it('creates invitation, sends email, and revalidates walk views', async () => {
      setupUser()
      mockSupabase.rpc.mockResolvedValue({
        data: { success: true, invitation_id: 'invite-1' },
        error: null,
      })

      let profileCall = 0
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'walk_slots') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'slot-1', walk_date: '2099-04-15', start_time: '08:00', location_name: 'Bukit Timah' },
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
                single: vi.fn().mockImplementation(() => {
                  profileCall += 1
                  return Promise.resolve({
                    data: profileCall === 1
                      ? { full_name: 'Alex', email: 'alex@test.com' }
                      : { full_name: 'June', email: 'june@test.com' },
                    error: null,
                  })
                }),
              }),
            }),
          }
        }

        return methods
      })

      const result = await inviteVolunteerToWalk('slot-1', 'user-2')

      expect(result).toEqual({ success: true })
      expect(mockSupabase.rpc).toHaveBeenCalledWith('create_slot_invitation', {
        p_slot_id: 'slot-1',
        p_invited_user_id: 'user-2',
      })
      expect(sendWalkInvitationEmail).toHaveBeenCalledWith(
        'alex@test.com',
        'Alex',
        'June',
        { id: 'slot-1', date: '2099-04-15', time: '08:00', location: 'Bukit Timah' }
      )
      expect(revalidatePath).toHaveBeenCalledWith('/walk')
      expect(revalidatePath).toHaveBeenCalledWith('/walk/slot-1')
      expect(revalidatePath).toHaveBeenCalledWith('/home')
      expect(revalidatePath).toHaveBeenCalledWith('/report')
      expect(revalidatePath).toHaveBeenCalledWith('/report/slot-1')
      expect(revalidatePath).toHaveBeenCalledWith('/profile')
    })

    it('returns invitation email warning when email send throws', async () => {
      setupUser()
      mockSupabase.rpc.mockResolvedValue({
        data: { success: true, invitation_id: 'invite-1' },
        error: null,
      })
      vi.mocked(sendWalkInvitationEmail).mockRejectedValueOnce(new Error('Email down'))

      let profileCall = 0
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'walk_slots') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'slot-1', walk_date: '2099-04-15', start_time: '08:00', location_name: 'Bukit Timah' },
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
                single: vi.fn().mockImplementation(() => {
                  profileCall += 1
                  return Promise.resolve({
                    data: profileCall === 1
                      ? { full_name: 'Alex', email: 'alex@test.com' }
                      : { full_name: 'June', email: 'june@test.com' },
                    error: null,
                  })
                }),
              }),
            }),
          }
        }

        return methods
      })

      const result = await inviteVolunteerToWalk('slot-1', 'user-2')

      expect(result).toEqual({
        success: true,
        warning: 'Invited successfully, but failed to send the invitation email.',
      })
    })

    it('responds to an invitation and revalidates the related slot', async () => {
      setupUser()
      mockSupabase.rpc.mockResolvedValue({
        data: { success: true },
        error: null,
      })

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'slot_invitations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { slot_id: 'slot-1' },
                  error: null,
                }),
              }),
            }),
          }
        }

        return methods
      })

      const result = await respondToSlotInvitation('invite-1', 'ACCEPTED')

      expect(result).toEqual({ success: true })
      expect(mockSupabase.rpc).toHaveBeenCalledWith('respond_to_slot_invitation', {
        p_invitation_id: 'invite-1',
        p_response: 'ACCEPTED',
      })
      expect(revalidatePath).toHaveBeenCalledWith('/walk/slot-1')
      expect(revalidatePath).toHaveBeenCalledWith('/report/slot-1')
    })

    it('rejects invalid invitation responses before authentication', async () => {
      const result = await respondToSlotInvitation('invite-1', 'CANCELLED' as 'ACCEPTED')

      expect(result).toEqual({ error: 'Invalid invitation response.' })
      expect(mockSupabase.auth.getUser).not.toHaveBeenCalled()
    })

    it('returns error when responding to invitations without authentication', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })

      const result = await respondToSlotInvitation('invite-1', 'REJECTED')

      expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('returns RPC errors when responding to invitations', async () => {
      setupUser()
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Response failed' },
      })

      const result = await respondToSlotInvitation('invite-1', 'REJECTED')

      expect(result).toEqual({ error: 'Response failed' })
    })

    it('falls back to list revalidation when response slot lookup is unavailable', async () => {
      setupUser()
      mockSupabase.rpc.mockResolvedValue({
        data: { success: true },
        error: null,
      })

      const result = await respondToSlotInvitation('invite-1', 'REJECTED')

      expect(result).toEqual({ success: true })
      expect(revalidatePath).toHaveBeenCalledWith('/walk')
      expect(revalidatePath).toHaveBeenCalledWith('/home')
      expect(revalidatePath).toHaveBeenCalledWith('/profile')
    })

    it('cancels a pending slot invitation', async () => {
      setupUser()
      mockSupabase.rpc.mockResolvedValue({
        data: { success: true },
        error: null,
      })

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'slot_invitations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { slot_id: 'slot-1' },
                  error: null,
                }),
              }),
            }),
          }
        }

        return methods
      })

      const result = await cancelSlotInvitation('invite-1')

      expect(result).toEqual({ success: true })
      expect(mockSupabase.rpc).toHaveBeenCalledWith('cancel_slot_invitation', {
        p_invitation_id: 'invite-1',
      })
      expect(revalidatePath).toHaveBeenCalledWith('/walk/slot-1')
    })

    it('returns error when cancelling invitations without authentication', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })

      const result = await cancelSlotInvitation('invite-1')

      expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('returns RPC errors when cancelling invitations', async () => {
      setupUser()
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Cancel failed' },
      })

      const result = await cancelSlotInvitation('invite-1')

      expect(result).toEqual({ error: 'Cancel failed' })
    })

    it('returns unexpected response errors for malformed cancel RPC payloads', async () => {
      setupUser()
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: null,
      })

      const result = await cancelSlotInvitation('invite-1')

      expect(result).toEqual({ error: 'Unexpected invitation response.' })
    })

    it('falls back to walk list revalidation when cancel slot lookup is unavailable', async () => {
      setupUser()
      mockSupabase.rpc.mockResolvedValue({
        data: { success: true },
        error: null,
      })

      const result = await cancelSlotInvitation('invite-1')

      expect(result).toEqual({ success: true })
      expect(revalidatePath).toHaveBeenCalledWith('/walk')
    })
  })

  describe('cancelWalk', () => {
    it('returns error when not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })

      const result = await cancelWalk('slot-1')

      expect(result).toEqual({ error: 'Not authenticated' })
    })

    // TC-UNIT-WALK-04 (UC-04): Cancel participation successfully and notify peers
    it('cancels slot and sends email notification', async () => {
      setupUser()
      setupCancelMocks()

      const result = await cancelWalk('slot-1')

      expect(result).toEqual({ success: true })
      expect(mockSupabase.rpc).toHaveBeenCalledWith('cancel_slot_with_draft_cleanup', {
        p_slot_id: 'slot-1',
      })
      expect(sendWalkCancellationEmail).toHaveBeenCalledWith(
        ['other@test.com'],
        { date: '2026-04-15', time: '08:00', location: 'Central Park' },
        'Test User'
      )
      expect(revalidatePath).toHaveBeenCalledWith('/walk')
      expect(revalidatePath).toHaveBeenCalledWith('/report')
      expect(revalidatePath).toHaveBeenCalledWith('/report/slot-1')
      expect(revalidatePath).toHaveBeenCalledWith('/profile')
    })

    it('returns error when DB update fails', async () => {
      setupUser()
      setupCancelMocks({
        rpcError: { message: 'Update failed' },
      })

      const result = await cancelWalk('slot-1')

      expect(result).toEqual({ error: 'Update failed' })
    })

    it('returns error when no active membership is cancelled', async () => {
      setupUser()
      setupCancelMocks({
        rpcResult: { error: 'You are not actively joined to this walk.' },
      })

      const result = await cancelWalk('slot-1')

      expect(result).toEqual({ error: 'You are not actively joined to this walk.' })
    })

    it('returns error when a submitted report already exists', async () => {
      setupUser()
      setupCancelMocks({
        rpcResult: { error: "You can't cancel this walk after submitting your report." },
      })

      const result = await cancelWalk('slot-1')

      expect(result).toEqual({ error: "You can't cancel this walk after submitting your report." })
    })

    it('returns error when RPC returns an unexpected empty payload', async () => {
      setupUser()
      setupCancelMocks({
        rpcResult: null,
      })

      const result = await cancelWalk('slot-1')

      expect(result).toEqual({ error: 'Unexpected cancellation response.' })
    })

    it('still succeeds when slot is not found for email', async () => {
      setupUser()
      setupCancelMocks({
        slot: null,
      })

      const result = await cancelWalk('slot-1')

      expect(result).toEqual({ success: true })
      expect(sendWalkCancellationEmail).not.toHaveBeenCalled()
    })

    it('still succeeds when no other members', async () => {
      setupUser()
      setupCancelMocks({
        otherMembers: [],
      })

      const result = await cancelWalk('slot-1')

      expect(result).toEqual({ success: true })
      expect(sendWalkCancellationEmail).not.toHaveBeenCalled()
    })

    it('still succeeds when recipients are empty after filter', async () => {
      setupUser()
      setupCancelMocks({
        otherMembers: [{ user_id: 'other-1', profiles: { email: null } }],
      })

      const result = await cancelWalk('slot-1')

      expect(result).toEqual({ success: true })
      expect(sendWalkCancellationEmail).not.toHaveBeenCalled()
    })

    // TC-UNIT-WALK-05 (UC-04 robustness): Cancellation still succeeds when email fails
    it('returns success with warning when email notification throws', async () => {
      setupUser()
      setupCancelMocks()
      vi.mocked(sendWalkCancellationEmail).mockRejectedValueOnce(
        new Error('Email service down')
      )

      const result = await cancelWalk('slot-1')

      expect(result).toEqual({
        success: true,
        warning: 'Cancelled successfully, but failed to notify other members.',
      })
    })

    it('returns success with warning when draft cleanup fails', async () => {
      setupUser()
      setupCancelMocks({
        rpcResult: { success: true, deleted_draft_count: 1, file_paths: ['drafts/user-1/photo.jpg'] },
      })
      mockSupabase.storage.from.mockReturnValueOnce({
        remove: vi.fn().mockResolvedValue({ error: { message: 'Delete failed' } }),
      })

      const result = await cancelWalk('slot-1')

      expect(result).toEqual({
        success: true,
        warning: 'Cancelled successfully, but failed to remove your draft report media.',
      })
      expect(sendWalkCancellationEmail).toHaveBeenCalled()
    })

    it('uses full_name for cancellingName', async () => {
      setupUser()
      setupCancelMocks({
        profile: { full_name: 'Jane Doe', email: 'jane@test.com' },
      })

      await cancelWalk('slot-1')

      expect(sendWalkCancellationEmail).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'Jane Doe'
      )
    })

    it('falls back to email for cancellingName', async () => {
      setupUser()
      setupCancelMocks({
        profile: { full_name: null, email: 'jane@test.com' },
      })

      await cancelWalk('slot-1')

      expect(sendWalkCancellationEmail).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'jane@test.com'
      )
    })

    it('falls back to "A volunteer" for cancellingName', async () => {
      setupUser()
      setupCancelMocks({
        profile: { full_name: null, email: null },
      })

      await cancelWalk('slot-1')

      expect(sendWalkCancellationEmail).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'A volunteer'
      )
    })
  })
})
