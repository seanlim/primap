import { NextRequest } from 'next/server'

const { mockGetClaims, mockGetUser } = vi.hoisted(() => ({
  mockGetClaims: vi.fn(),
  mockGetUser: vi.fn(),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getClaims: mockGetClaims, getUser: mockGetUser },
  })),
}))

import { middleware } from '@/middleware'

function makeRequest(path: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`)
}

function claimsFor(userId: string) {
  return {
    data: { claims: { sub: userId }, header: {}, signature: new Uint8Array() },
    error: null,
  }
}

describe('middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'
    mockGetClaims.mockResolvedValue({ data: null, error: null })
    mockGetUser.mockResolvedValue({ data: { user: null } })
  })

  // --- Unauthenticated ---

  it('redirects unauthenticated user from /home to /login', async () => {
    const response = await middleware(makeRequest('/home'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/login')
  })

  it('redirects unauthenticated user from an RSC prefetch to /login', async () => {
    const response = await middleware(makeRequest('/profile?_rsc=abc123'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/login')
  })

  it('allows unauthenticated user to access /login', async () => {
    const response = await middleware(makeRequest('/login'))

    expect(response.status).toBe(200)
  })

  it('allows unauthenticated user to access /', async () => {
    const response = await middleware(makeRequest('/'))

    expect(response.status).toBe(200)
  })

  it('allows unauthenticated user to access /pending', async () => {
    const response = await middleware(makeRequest('/pending'))

    expect(response.status).toBe(200)
  })

  it('does not hit the Auth server for anonymous requests', async () => {
    await middleware(makeRequest('/home'))

    expect(mockGetUser).not.toHaveBeenCalled()
  })

  // --- Authenticated on /login ---

  it('redirects authenticated user from /login to /home', async () => {
    mockGetClaims.mockResolvedValue(claimsFor('user-1'))

    const response = await middleware(makeRequest('/login'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/home')
  })

  it('allows authenticated user to stay on /login with profile_fetch_failed error', async () => {
    mockGetClaims.mockResolvedValue(claimsFor('user-1'))

    const response = await middleware(makeRequest('/login?error=profile_fetch_failed'))

    expect(response.status).toBe(200)
  })

  // --- Authenticated app routes ---

  it('allows an authenticated user through without querying profiles', async () => {
    mockGetClaims.mockResolvedValue(claimsFor('user-1'))

    const response = await middleware(makeRequest('/home'))

    expect(response.status).toBe(200)
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it('forwards the pathname so layouts can gate on the current route', async () => {
    mockGetClaims.mockResolvedValue(claimsFor('user-1'))

    const response = await middleware(makeRequest('/admin/users'))

    expect(response.status).toBe(200)
    expect(response.headers.get('x-middleware-request-x-pathname')).toBe('/admin/users')
  })

  it('refreshes an expired token through getUser as a fallback', async () => {
    mockGetClaims.mockResolvedValue({
      data: null,
      error: { message: 'JWT expired', name: 'AuthInvalidJwtError' },
    })
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const response = await middleware(makeRequest('/home'))

    expect(mockGetUser).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(200)
  })

  it('redirects when the token cannot be refreshed', async () => {
    mockGetClaims.mockResolvedValue({
      data: null,
      error: { message: 'JWT expired', name: 'AuthInvalidJwtError' },
    })
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const response = await middleware(makeRequest('/home'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/login')
  })

  // --- Cron route ---

  it('bypasses auth for the cron endpoint', async () => {
    const response = await middleware(makeRequest('/api/cron/reminders'))

    expect(response.status).toBe(200)
    expect(mockGetClaims).not.toHaveBeenCalled()
  })
})
