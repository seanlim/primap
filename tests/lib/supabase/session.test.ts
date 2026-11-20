import { getSession, requireSession, getCurrentProfile } from '@/lib/supabase/session'

const { mockSupabase, mockRedirect } = vi.hoisted(() => {
  const mockSupabase = {
    auth: { getClaims: vi.fn() },
    from: vi.fn(),
  }
  const mockRedirect = vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  })
  return { mockSupabase, mockRedirect }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
}))

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
}))

function mockProfileQuery(result: { data?: unknown; error?: { code?: string; message: string } | null }) {
  mockSupabase.from.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: result.data ?? null,
          error: result.error ?? null,
        }),
      }),
    }),
  })
}

describe('session helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getSession', () => {
    it('exposes the user id from the verified claims', async () => {
      mockSupabase.auth.getClaims.mockResolvedValue({ data: { claims: { sub: 'user-1' } }, error: null })

      const session = await getSession()

      expect(session.userId).toBe('user-1')
      expect(session.supabase).toBe(mockSupabase)
    })

    it('returns no user id when there is no session', async () => {
      mockSupabase.auth.getClaims.mockResolvedValue({ data: null, error: null })

      const session = await getSession()

      expect(session.userId).toBeNull()
    })
  })

  describe('requireSession', () => {
    it('redirects unauthenticated visitors to /login', async () => {
      mockSupabase.auth.getClaims.mockResolvedValue({ data: null, error: null })

      await expect(requireSession()).rejects.toThrow('NEXT_REDIRECT:/login')
      expect(mockRedirect).toHaveBeenCalledWith('/login')
    })

    it('returns the id for an authenticated user', async () => {
      mockSupabase.auth.getClaims.mockResolvedValue({ data: { claims: { sub: 'user-1' } }, error: null })

      await expect(requireSession()).resolves.toEqual({ supabase: mockSupabase, userId: 'user-1' })
    })
  })

  describe('getCurrentProfile', () => {
    it('returns the gating columns for the signed-in user', async () => {
      mockSupabase.auth.getClaims.mockResolvedValue({ data: { claims: { sub: 'user-1' } }, error: null })
      mockProfileQuery({
        data: { id: 'user-1', status: 'ACTIVE', role: 'VOLUNTEER', phone_number: '+6591234567' },
      })

      const { profile, error } = await getCurrentProfile()

      expect(error).toBeNull()
      expect(profile).toEqual({
        id: 'user-1',
        status: 'ACTIVE',
        role: 'VOLUNTEER',
        phone_number: '+6591234567',
      })
    })

    it('surfaces the PostgREST error so callers can distinguish missing rows', async () => {
      mockSupabase.auth.getClaims.mockResolvedValue({ data: { claims: { sub: 'user-1' } }, error: null })
      mockProfileQuery({ error: { code: 'PGRST116', message: 'No rows found' } })

      const { profile, error } = await getCurrentProfile()

      expect(profile).toBeNull()
      expect(error).toEqual({ code: 'PGRST116', message: 'No rows found' })
    })

    it('does not query the database without a session', async () => {
      mockSupabase.auth.getClaims.mockResolvedValue({ data: null, error: null })

      const { profile, error } = await getCurrentProfile()

      expect(profile).toBeNull()
      expect(error).toBeNull()
      expect(mockSupabase.from).not.toHaveBeenCalled()
    })
  })
})
