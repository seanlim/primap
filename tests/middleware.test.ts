import { NextRequest } from 'next/server'

const mockGetUser = vi.fn()
const mockSingle = vi.fn()

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: mockSingle,
        }),
      }),
    }),
  })),
}))

import { middleware } from '@/middleware'

function makeRequest(path: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`)
}

const completeContact = {
  phone_number: '+6591234567',
  phone_verified_at: '2026-01-01T00:00:00.000Z',
  date_of_birth: '1990-01-01',
  guardian_phone_number: null,
  guardian_phone_verified_at: null,
}

describe('middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'
    mockGetUser.mockResolvedValue({ data: { user: null } })
    mockSingle.mockResolvedValue({ data: null, error: null })
  })

  // --- Unauthenticated ---

  it('redirects unauthenticated user from /home to /login', async () => {
    const response = await middleware(makeRequest('/home'))

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

  // --- Authenticated on /login ---

  it('redirects authenticated user from /login to /home', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const response = await middleware(makeRequest('/login'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/home')
  })

  it('allows authenticated user to stay on /login with profile_fetch_failed error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const response = await middleware(makeRequest('/login?error=profile_fetch_failed'))

    expect(response.status).toBe(200)
  })

  // --- Authenticated with profile statuses ---

  it('allows ACTIVE VOLUNTEER to access /home', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingle.mockResolvedValue({
      data: { status: 'ACTIVE', role: 'VOLUNTEER', ...completeContact },
      error: null,
    })

    const response = await middleware(makeRequest('/home'))

    expect(response.status).toBe(200)
  })

  it('redirects incomplete ACTIVE user to /complete-profile', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingle.mockResolvedValue({
      data: {
        status: 'ACTIVE',
        role: 'VOLUNTEER',
        phone_number: null,
        phone_verified_at: null,
        date_of_birth: null,
        guardian_phone_number: null,
        guardian_phone_verified_at: null,
      },
      error: null,
    })

    const response = await middleware(makeRequest('/home'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/complete-profile')
  })

  it('redirects PENDING user from /home to /pending', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingle.mockResolvedValue({
      data: { status: 'PENDING', role: 'VOLUNTEER', ...completeContact },
      error: null,
    })

    const response = await middleware(makeRequest('/home'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/pending')
  })

  it('redirects REJECTED user from /home to /blocked', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingle.mockResolvedValue({
      data: { status: 'REJECTED', role: 'VOLUNTEER', ...completeContact },
      error: null,
    })

    const response = await middleware(makeRequest('/home'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/blocked')
  })

  it('redirects DISABLED user from /home to /blocked', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingle.mockResolvedValue({
      data: { status: 'DISABLED', role: 'VOLUNTEER', ...completeContact },
      error: null,
    })

    const response = await middleware(makeRequest('/home'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/blocked')
  })

  it('allows PENDING user to stay on /pending (no redirect)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingle.mockResolvedValue({
      data: { status: 'PENDING', role: 'VOLUNTEER', ...completeContact },
      error: null,
    })

    const response = await middleware(makeRequest('/pending'))

    expect(response.status).toBe(200)
  })

  // --- Profile fetch errors ---

  it('redirects to /login with error on profile fetch failure', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: 'DB error' },
    })

    const response = await middleware(makeRequest('/home'))

    expect(response.status).toBe(307)
    const location = response.headers.get('location')!
    expect(location).toContain('/login')
    expect(location).toContain('error=profile_fetch_failed')
  })

  it('redirects to /pending when profile is null', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingle.mockResolvedValue({ data: null, error: null })

    const response = await middleware(makeRequest('/home'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/pending')
  })

  // --- Admin access control ---

  it('redirects non-ADMIN from /admin to /home', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingle.mockResolvedValue({
      data: { status: 'ACTIVE', role: 'VOLUNTEER', ...completeContact },
      error: null,
    })

    const response = await middleware(makeRequest('/admin'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/home')
  })

  it('allows ADMIN to access /admin', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingle.mockResolvedValue({
      data: { status: 'ACTIVE', role: 'ADMIN', ...completeContact },
      error: null,
    })

    const response = await middleware(makeRequest('/admin'))

    expect(response.status).toBe(200)
  })

  it('allows ADMIN to access /admin/users', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingle.mockResolvedValue({
      data: { status: 'ACTIVE', role: 'ADMIN', ...completeContact },
      error: null,
    })

    const response = await middleware(makeRequest('/admin/users'))

    expect(response.status).toBe(200)
  })
})
