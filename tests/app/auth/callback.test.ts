const { mockExchange } = vi.hoisted(() => ({
  mockExchange: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { exchangeCodeForSession: mockExchange },
  }),
}))

import { GET } from '@/app/(auth)/auth/callback/route'

describe('GET /auth/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to /home when code is valid and exchange succeeds', async () => {
    mockExchange.mockResolvedValue({ error: null })

    const request = new Request('http://localhost:3000/auth/callback?code=abc123')
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/home')
  })

  it('redirects to custom next path when provided', async () => {
    mockExchange.mockResolvedValue({ error: null })

    const request = new Request('http://localhost:3000/auth/callback?code=abc123&next=/dashboard')
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/dashboard')
  })

  it('redirects to /login with error when exchange fails', async () => {
    mockExchange.mockResolvedValue({ error: { message: 'Invalid code' } })

    const request = new Request('http://localhost:3000/auth/callback?code=bad-code')
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/login?error=auth_callback_error'
    )
  })

  it('redirects to /login with error when no code is provided', async () => {
    const request = new Request('http://localhost:3000/auth/callback')
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/login?error=auth_callback_error'
    )
    expect(mockExchange).not.toHaveBeenCalled()
  })
})
