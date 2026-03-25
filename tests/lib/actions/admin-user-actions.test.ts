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
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  }
  for (const key of Object.keys(methods) as (keyof typeof methods)[]) {
    if (key !== 'single') methods[key].mockReturnThis()
  }
  const mockSupabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
    from: vi.fn().mockReturnValue(methods),
  }
  return { mockSupabase, methods }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
}))

vi.mock('@/lib/email', () => ({
  sendAccountApprovedEmail: vi.fn(),
  sendAccountRejectedEmail: vi.fn(),
  sendAccountDisabledEmail: vi.fn(),
  sendAccountEnabledEmail: vi.fn(),
  sendRolePromotedEmail: vi.fn(),
  sendRoleDemotedEmail: vi.fn(),
}))

import {
  approveUser,
  rejectUser,
  disableUser,
  enableUser,
  setUserRole,
} from '@/lib/actions/admin-user-actions'
import {
  sendAccountApprovedEmail,
  sendAccountRejectedEmail,
  sendAccountDisabledEmail,
  sendAccountEnabledEmail,
  sendRolePromotedEmail,
  sendRoleDemotedEmail,
} from '@/lib/email'

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
  methods.single.mockResolvedValue({ data: null, error: null })
}

function setupAdmin() {
  mockSupabase.auth.getUser.mockResolvedValue({
    data: { user: { id: 'admin-1' } },
  })
  methods.single.mockResolvedValueOnce({ data: { role: 'ADMIN' }, error: null })
}

describe('admin-user-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetChain()
  })

  describe('requireAdmin', () => {
    it('throws when no user is authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })

      await expect(approveUser('user-1')).rejects.toThrow('Not authenticated')
    })

    it('throws when role is not ADMIN', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1' } },
      })
      methods.single.mockResolvedValueOnce({
        data: { role: 'VOLUNTEER' },
        error: null,
      })

      await expect(approveUser('user-2')).rejects.toThrow('Not authorized')
    })
  })

  describe('approveUser', () => {
    it('approves user, sends email, and revalidates', async () => {
      setupAdmin()
      methods.single.mockResolvedValueOnce({
        data: { email: 'user@test.com', full_name: 'Test User' },
        error: null,
      })

      const result = await approveUser('user-2')

      expect(result).toEqual({ success: true })
      expect(mockSupabase.from).toHaveBeenCalledWith('profiles')
      expect(methods.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ACTIVE' })
      )
      expect(sendAccountApprovedEmail).toHaveBeenCalledWith(
        'user@test.com',
        'Test User'
      )
      expect(revalidatePath).toHaveBeenCalledWith('/admin/users')
    })

    it('returns error on DB failure', async () => {
      setupAdmin()
      methods.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'DB error' },
      })

      const result = await approveUser('user-2')

      expect(result).toEqual({ error: 'DB error' })
      expect(sendAccountApprovedEmail).not.toHaveBeenCalled()
    })
  })

  describe('rejectUser', () => {
    it('rejects user, sends email, and revalidates', async () => {
      setupAdmin()
      methods.single.mockResolvedValueOnce({
        data: { email: 'user@test.com', full_name: 'Test User' },
        error: null,
      })

      const result = await rejectUser('user-2')

      expect(result).toEqual({ success: true })
      expect(methods.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'REJECTED' })
      )
      expect(sendAccountRejectedEmail).toHaveBeenCalledWith(
        'user@test.com',
        'Test User'
      )
      expect(revalidatePath).toHaveBeenCalledWith('/admin/users')
    })

    it('blocks self-rejection', async () => {
      setupAdmin()

      const result = await rejectUser('admin-1')

      expect(result).toEqual({ error: 'Cannot reject your own account' })
    })

    it('returns error on DB failure', async () => {
      setupAdmin()
      methods.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'DB error' },
      })

      const result = await rejectUser('user-2')

      expect(result).toEqual({ error: 'DB error' })
      expect(sendAccountRejectedEmail).not.toHaveBeenCalled()
    })
  })

  describe('disableUser', () => {
    it('disables user, sends email, and revalidates', async () => {
      setupAdmin()
      methods.single.mockResolvedValueOnce({
        data: { email: 'user@test.com', full_name: 'Test User' },
        error: null,
      })

      const result = await disableUser('user-2')

      expect(result).toEqual({ success: true })
      expect(methods.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'DISABLED' })
      )
      expect(sendAccountDisabledEmail).toHaveBeenCalledWith(
        'user@test.com',
        'Test User'
      )
      expect(revalidatePath).toHaveBeenCalledWith('/admin/users')
    })

    it('blocks self-disable', async () => {
      setupAdmin()

      const result = await disableUser('admin-1')

      expect(result).toEqual({ error: 'Cannot disable your own account' })
    })

    it('returns error on DB failure', async () => {
      setupAdmin()
      methods.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'DB error' },
      })

      const result = await disableUser('user-2')

      expect(result).toEqual({ error: 'DB error' })
      expect(sendAccountDisabledEmail).not.toHaveBeenCalled()
    })
  })

  describe('enableUser', () => {
    it('enables user, sends email, and revalidates', async () => {
      setupAdmin()
      methods.single.mockResolvedValueOnce({
        data: { email: 'user@test.com', full_name: 'Test User' },
        error: null,
      })

      const result = await enableUser('user-2')

      expect(result).toEqual({ success: true })
      expect(methods.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ACTIVE' })
      )
      expect(sendAccountEnabledEmail).toHaveBeenCalledWith(
        'user@test.com',
        'Test User'
      )
      expect(revalidatePath).toHaveBeenCalledWith('/admin/users')
    })

    it('returns error on DB failure', async () => {
      setupAdmin()
      methods.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'DB error' },
      })

      const result = await enableUser('user-2')

      expect(result).toEqual({ error: 'DB error' })
      expect(sendAccountEnabledEmail).not.toHaveBeenCalled()
    })
  })

  describe('setUserRole', () => {
    it('promotes to ADMIN, sends promotion email, and revalidates', async () => {
      setupAdmin()
      // First .single() → fetch target profile
      methods.single.mockResolvedValueOnce({
        data: { status: 'ACTIVE', email: 'user@test.com', full_name: 'Test User' },
        error: null,
      })
      // Second .single() → update role
      methods.single.mockResolvedValueOnce({
        data: { id: 'user-2' },
        error: null,
      })

      const result = await setUserRole('user-2', 'ADMIN')

      expect(result).toEqual({ success: true })
      expect(methods.update).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'ADMIN' })
      )
      expect(sendRolePromotedEmail).toHaveBeenCalledWith('user@test.com', 'Test User')
      expect(sendRoleDemotedEmail).not.toHaveBeenCalled()
      expect(revalidatePath).toHaveBeenCalledWith('/admin/users')
    })

    it('demotes to VOLUNTEER, sends demotion email, and revalidates', async () => {
      setupAdmin()
      methods.single.mockResolvedValueOnce({
        data: { status: 'ACTIVE', email: 'user@test.com', full_name: 'Test User' },
        error: null,
      })
      methods.single.mockResolvedValueOnce({
        data: { id: 'user-2' },
        error: null,
      })

      const result = await setUserRole('user-2', 'VOLUNTEER')

      expect(result).toEqual({ success: true })
      expect(methods.update).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'VOLUNTEER' })
      )
      expect(sendRoleDemotedEmail).toHaveBeenCalledWith('user@test.com', 'Test User')
      expect(sendRolePromotedEmail).not.toHaveBeenCalled()
    })

    it('blocks role change for non-ACTIVE users', async () => {
      setupAdmin()
      methods.single.mockResolvedValueOnce({
        data: { status: 'PENDING', email: 'user@test.com', full_name: 'Test User' },
        error: null,
      })

      const result = await setUserRole('user-2', 'ADMIN')

      expect(result).toEqual({ error: 'Can only change role for active users' })
      expect(methods.update).not.toHaveBeenCalled()
      expect(sendRolePromotedEmail).not.toHaveBeenCalled()
    })

    it('blocks self-demotion to VOLUNTEER', async () => {
      setupAdmin()

      const result = await setUserRole('admin-1', 'VOLUNTEER')

      expect(result).toEqual({ error: 'Cannot demote your own account' })
    })

    it('returns error when target user fetch fails', async () => {
      setupAdmin()
      methods.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'User not found' },
      })

      const result = await setUserRole('user-2', 'ADMIN')

      expect(result).toEqual({ error: 'User not found' })
      expect(methods.update).not.toHaveBeenCalled()
    })

    it('returns error on update DB failure', async () => {
      setupAdmin()
      methods.single.mockResolvedValueOnce({
        data: { status: 'ACTIVE', email: 'user@test.com', full_name: 'Test User' },
        error: null,
      })
      methods.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'DB error' },
      })

      const result = await setUserRole('user-2', 'ADMIN')

      expect(result).toEqual({ error: 'DB error' })
      expect(sendRolePromotedEmail).not.toHaveBeenCalled()
    })
  })
})
