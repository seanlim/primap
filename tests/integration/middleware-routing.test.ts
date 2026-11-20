/**
 * Integration test: real access-policy functions wired through the layers that
 * enforce them.
 *
 * `middleware.ts` now only authenticates (no database access). Account status,
 * phone completion and admin gating moved to `app/(app)/layout.tsx`, which reads
 * the pathname from the `x-pathname` header the middleware sets. Both layers are
 * exercised here with the real access-policy helpers.
 *
 * Only external boundaries are mocked: @supabase/ssr (auth), next/headers,
 * next/navigation and the layout's presentational shell.
 */

import { NextRequest } from 'next/server'

const { mockGetClaims, mockGetUser, mockRequireSession, mockGetCurrentProfile, mockRedirect, mockHeaders, pathnameRef } =
  vi.hoisted(() => {
    const pathnameRef = { current: '/home' }
    return {
      mockGetClaims: vi.fn(),
      mockGetUser: vi.fn(),
      mockRequireSession: vi.fn(),
      mockGetCurrentProfile: vi.fn(),
      mockRedirect: vi.fn((url: string) => {
        throw new Error(`NEXT_REDIRECT:${url}`)
      }),
      mockHeaders: vi.fn(async () => new Headers({ 'x-pathname': pathnameRef.current })),
      pathnameRef,
    }
  })

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getClaims: mockGetClaims, getUser: mockGetUser },
  })),
}))

vi.mock('@/lib/supabase/session', () => ({
  requireSession: mockRequireSession,
  getCurrentProfile: mockGetCurrentProfile,
}))

vi.mock('next/navigation', () => ({ redirect: mockRedirect }))
vi.mock('next/headers', () => ({ headers: mockHeaders }))
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: unknown }) => children,
}))
vi.mock('@/components/ui/toast', () => ({
  ToastProvider: ({ children }: { children: unknown }) => children,
}))

import { middleware } from '@/middleware'
import AppLayout from '@/app/(app)/layout'

function makeRequest(path: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`)
}

function claimsFor(userId: string) {
  return {
    data: { claims: { sub: userId }, header: {}, signature: new Uint8Array() },
    error: null,
  }
}

async function renderLayout(pathname: string) {
  pathnameRef.current = pathname
  try {
    await AppLayout({ children: null })
    return null
  } catch (error) {
    return (error as Error).message
  }
}

describe('middleware authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'
    mockGetClaims.mockResolvedValue({ data: null, error: null })
    mockGetUser.mockResolvedValue({ data: { user: null } })
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
    mockGetClaims.mockResolvedValue(claimsFor('user-1'))

    const response = await middleware(makeRequest('/login'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/home')
  })

  it('authenticated → /home → pass through without touching the database', async () => {
    mockGetClaims.mockResolvedValue(claimsFor('user-1'))

    const response = await middleware(makeRequest('/home'))

    expect(response.status).toBe(200)
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it('expired token → refresh through getUser → pass through', async () => {
    mockGetClaims.mockResolvedValue({ data: null, error: { message: 'JWT expired' } })
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const response = await middleware(makeRequest('/home'))

    expect(response.status).toBe(200)
    expect(mockGetUser).toHaveBeenCalledTimes(1)
  })
})

describe('app layout account gating', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireSession.mockResolvedValue({ supabase: {}, userId: 'user-1' })
    mockGetCurrentProfile.mockResolvedValue({
      profile: { id: 'user-1', status: 'ACTIVE', role: 'VOLUNTEER', phone_number: '+6591234567' },
      error: null,
    })
  })

  it('ACTIVE volunteer with a phone → /home → pass through', async () => {
    expect(await renderLayout('/home')).toBeNull()
  })

  it('PENDING → /home → resolveStatusRedirect returns /pending', async () => {
    mockGetCurrentProfile.mockResolvedValue({
      profile: { id: 'user-1', status: 'PENDING', role: 'VOLUNTEER', phone_number: null },
      error: null,
    })

    expect(await renderLayout('/home')).toBe('NEXT_REDIRECT:/pending')
  })

  it('REJECTED → /walk → resolveStatusRedirect returns /blocked', async () => {
    mockGetCurrentProfile.mockResolvedValue({
      profile: { id: 'user-1', status: 'REJECTED', role: 'VOLUNTEER', phone_number: null },
      error: null,
    })

    expect(await renderLayout('/walk')).toBe('NEXT_REDIRECT:/blocked')
  })

  it('DISABLED → /walk → resolveStatusRedirect returns /blocked', async () => {
    mockGetCurrentProfile.mockResolvedValue({
      profile: { id: 'user-1', status: 'DISABLED', role: 'VOLUNTEER', phone_number: null },
      error: null,
    })

    expect(await renderLayout('/walk')).toBe('NEXT_REDIRECT:/blocked')
  })

  it('ACTIVE volunteer without a phone → /home → needsPhoneCompletion sends them to /profile', async () => {
    mockGetCurrentProfile.mockResolvedValue({
      profile: { id: 'user-1', status: 'ACTIVE', role: 'VOLUNTEER', phone_number: null },
      error: null,
    })

    expect(await renderLayout('/home')).toBe('NEXT_REDIRECT:/profile?phone=required')
  })

  it('ACTIVE volunteer without a phone → /profile → allowed', async () => {
    mockGetCurrentProfile.mockResolvedValue({
      profile: { id: 'user-1', status: 'ACTIVE', role: 'VOLUNTEER', phone_number: null },
      error: null,
    })

    expect(await renderLayout('/profile')).toBeNull()
  })

  it('ACTIVE admin without a phone → /admin → allowed', async () => {
    mockGetCurrentProfile.mockResolvedValue({
      profile: { id: 'user-1', status: 'ACTIVE', role: 'ADMIN', phone_number: null },
      error: null,
    })

    expect(await renderLayout('/admin')).toBeNull()
  })

  it('profile fetch error → redirect /login?error=profile_fetch_failed', async () => {
    mockGetCurrentProfile.mockResolvedValue({
      profile: null,
      error: { message: 'DB connection failed' },
    })

    expect(await renderLayout('/home')).toBe('NEXT_REDIRECT:/login?error=profile_fetch_failed')
  })

  it('missing profile row → redirect /pending', async () => {
    mockGetCurrentProfile.mockResolvedValue({
      profile: null,
      error: { code: 'PGRST116', message: 'No rows found' },
    })

    expect(await renderLayout('/home')).toBe('NEXT_REDIRECT:/pending')
  })
})
