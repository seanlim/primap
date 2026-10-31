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

import { updateProfile } from '@/lib/actions/profile-actions'
import { PHONE_INVALID_MESSAGE, PHONE_REQUIRED_MESSAGE } from '@/lib/utils/phone'

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

describe('profile-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetChain()
  })

  describe('updateProfile', () => {
    it('returns error when not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })

      const result = await updateProfile({ fullName: 'Test User', phoneNumber: '91234567' })

      expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('returns success on valid update and normalises the phone number', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1' } },
      })

      const result = await updateProfile({ fullName: ' Updated Name ', phoneNumber: '9123 4567' })

      expect(result).toEqual({ success: true })
      expect(mockSupabase.from).toHaveBeenCalledWith('profiles')
      expect(methods.update).toHaveBeenCalledWith({
        full_name: 'Updated Name',
        phone_number: '+6591234567',
      })
      expect(methods.eq).toHaveBeenCalledWith('id', 'user-1')
      expect(revalidatePath).toHaveBeenCalledWith('/profile')
      expect(revalidatePath).toHaveBeenCalledWith('/home')
      expect(revalidatePath).toHaveBeenCalledWith('/walk')
    })

    it('stores an empty name as null', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1' } },
      })

      const result = await updateProfile({ fullName: '   ', phoneNumber: '+6591234567' })

      expect(result).toEqual({ success: true })
      expect(methods.update).toHaveBeenCalledWith({
        full_name: null,
        phone_number: '+6591234567',
      })
    })

    it('rejects a missing phone number without touching the database', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1' } },
      })

      const result = await updateProfile({ fullName: 'Test User', phoneNumber: '  ' })

      expect(result).toEqual({
        error: PHONE_REQUIRED_MESSAGE,
        fieldErrors: { phoneNumber: PHONE_REQUIRED_MESSAGE },
      })
      expect(methods.update).not.toHaveBeenCalled()
    })

    it('rejects an invalid phone number without touching the database', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1' } },
      })

      const result = await updateProfile({ fullName: 'Test User', phoneNumber: '12345' })

      expect(result).toEqual({
        error: PHONE_INVALID_MESSAGE,
        fieldErrors: { phoneNumber: PHONE_INVALID_MESSAGE },
      })
      expect(methods.update).not.toHaveBeenCalled()
    })

    it('returns error when DB update fails', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1' } },
      })
      methods.eq.mockReturnValueOnce({ error: { message: 'Database error' } })

      const result = await updateProfile({ fullName: 'Bad Name', phoneNumber: '91234567' })

      expect(result).toEqual({ error: 'Database error' })
      expect(revalidatePath).not.toHaveBeenCalled()
    })
  })
})
