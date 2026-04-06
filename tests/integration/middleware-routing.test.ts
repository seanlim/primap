/**
 * Integration test: full middleware with real access-policy functions, only mocking Supabase auth.
 *
 * Only external boundary mocked:
 *   1. @supabase/ssr (createServerClient) — Supabase auth + DB
 *
 * The real access-policy module (isPublicPath, needsProfileCheck, resolveStatusRedirect)
 * wires through naturally.
 */

import { NextRequest } from 'next/server'

const mockGetUser = vi.fn()
const mockSingle = vi.fn()

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: mockSingle }),
      }),
    }),
  })),
}))

import { middleware } from '@/middleware'

function makeRequest(path: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`)
}

describe('middleware-routing (integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'
    mockGetUser.mockResolvedValue({ data: { user: null } })
    mockSingle.mockResolvedValue({ data: null, error: null })
  })

  it('unauthenticated → /home → real isPublicPath returns false → redirect /login', async () => {
    const response = await middleware(makeRequest('/home'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/login')
  })

  it('unauthenticated → /login → real isPublicPath returns true → pass through', async () => {
    const response = await middleware(makeRequest('/login'))

    expect(response.status).toBe(200)
  })

  it('authenticated → /login → redirect /home', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const response = await middleware(makeRequest('/login'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/home')
  })

  // TC-INT-AUTH-01 (UC-01): Pending accounts are blocked from normal app routes
  it('authenticated PENDING → /home → real resolveStatusRedirect returns /pending → redirect /pending', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingle.mockResolvedValue({
      data: { status: 'PENDING', role: 'VOLUNTEER' },
      error: null,
    })

    const response = await middleware(makeRequest('/home'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/pending')
  })

  it('authenticated REJECTED → /walk → real resolveStatusRedirect returns /blocked → redirect /blocked', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingle.mockResolvedValue({
      data: { status: 'REJECTED', role: 'VOLUNTEER' },
      error: null,
    })

    const response = await middleware(makeRequest('/walk'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/blocked')
  })

  it('authenticated ACTIVE VOLUNTEER → /admin → role check → redirect /home', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingle.mockResolvedValue({
      data: { status: 'ACTIVE', role: 'VOLUNTEER' },
      error: null,
    })

    const response = await middleware(makeRequest('/admin'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/home')
  })

  it('authenticated ACTIVE ADMIN → /admin → pass through', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingle.mockResolvedValue({
      data: { status: 'ACTIVE', role: 'ADMIN' },
      error: null,
    })

    const response = await middleware(makeRequest('/admin'))

    expect(response.status).toBe(200)
  })

  it('profile fetch error → redirect /login?error=profile_fetch_failed', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: 'DB connection failed' },
    })

    const response = await middleware(makeRequest('/home'))

    expect(response.status).toBe(307)
    const location = response.headers.get('location')!
    expect(location).toContain('/login')
    expect(location).toContain('error=profile_fetch_failed')
  })
})
