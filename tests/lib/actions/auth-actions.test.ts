import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

const { mockSupabase } = vi.hoisted(() => {
  const mockSupabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      signOut: vi.fn().mockResolvedValue({}),
    },
    from: vi.fn(),
  }
  return { mockSupabase }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
}))

import { signOut } from '@/lib/actions/auth-actions'

describe('auth-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('signOut', () => {
    it('calls supabase.auth.signOut', async () => {
      await expect(signOut()).rejects.toThrow('NEXT_REDIRECT:/login')
      expect(mockSupabase.auth.signOut).toHaveBeenCalled()
    })

    it('calls revalidatePath with / and layout', async () => {
      await expect(signOut()).rejects.toThrow('NEXT_REDIRECT:/login')
      expect(revalidatePath).toHaveBeenCalledWith('/', 'layout')
    })

    it('calls redirect to /login which throws', async () => {
      await expect(signOut()).rejects.toThrow('NEXT_REDIRECT:/login')
      expect(redirect).toHaveBeenCalledWith('/login')
    })
  })
})
