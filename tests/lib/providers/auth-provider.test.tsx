import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import { AuthProvider, AuthContext } from '@/lib/providers/auth-provider'
import { useContext } from 'react'

// Mock supabase client
const mockGetUser = vi.fn()
const mockSignOut = vi.fn()
const mockOnAuthStateChange = vi.fn()
const mockSingle = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
      signOut: mockSignOut,
      onAuthStateChange: mockOnAuthStateChange,
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: mockSingle,
        }),
      }),
    }),
  })),
}))

function TestConsumer() {
  const ctx = useContext(AuthContext)
  if (!ctx) return <div>no context</div>
  return (
    <div>
      <span data-testid="loading">{String(ctx.loading)}</span>
      <span data-testid="user">{ctx.user?.id ?? 'none'}</span>
      <span data-testid="profile">{ctx.profile?.full_name ?? 'none'}</span>
      <button data-testid="signout" onClick={ctx.signOut}>Sign Out</button>
      <button data-testid="refresh" onClick={ctx.refreshProfile}>Refresh</button>
    </div>
  )
}

describe('AuthProvider', () => {
  let authStateCallback: ((event: string, session: { user: { id: string } } | null) => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    authStateCallback = null
    mockOnAuthStateChange.mockImplementation((cb: typeof authStateCallback) => {
      authStateCallback = cb
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })
  })

  it('initializes with loading true, then loads user and profile', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingle.mockResolvedValue({
      data: { id: 'user-1', full_name: 'John', email: 'john@test.com', role: 'VOLUNTEER', status: 'ACTIVE', avatar_url: null, created_at: '', updated_at: '' },
      error: null,
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
    })

    expect(screen.getByTestId('user').textContent).toBe('user-1')
    expect(screen.getByTestId('profile').textContent).toBe('John')
  })

  it('initializes with no user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
    })

    expect(screen.getByTestId('user').textContent).toBe('none')
    expect(screen.getByTestId('profile').textContent).toBe('none')
  })

  it('updates on auth state change with user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
    })

    // Simulate auth state change
    mockSingle.mockResolvedValueOnce({
      data: { id: 'user-2', full_name: 'Jane', email: 'jane@test.com', role: 'ADMIN', status: 'ACTIVE', avatar_url: null, created_at: '', updated_at: '' },
      error: null,
    })

    await act(async () => {
      authStateCallback?.('SIGNED_IN', { user: { id: 'user-2' } })
    })

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('user-2')
    })
    expect(screen.getByTestId('profile').textContent).toBe('Jane')
  })

  it('clears profile on auth state change with null session', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingle.mockResolvedValue({
      data: { id: 'user-1', full_name: 'John', email: 'john@test.com', role: 'VOLUNTEER', status: 'ACTIVE', avatar_url: null, created_at: '', updated_at: '' },
      error: null,
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('user-1')
    })

    await act(async () => {
      authStateCallback?.('SIGNED_OUT', null)
    })

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('none')
    })
    expect(screen.getByTestId('profile').textContent).toBe('none')
  })

  it('signOut clears user and profile', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSignOut.mockResolvedValue({})
    mockSingle.mockResolvedValue({
      data: { id: 'user-1', full_name: 'John', email: 'john@test.com', role: 'VOLUNTEER', status: 'ACTIVE', avatar_url: null, created_at: '', updated_at: '' },
      error: null,
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('user-1')
    })

    await act(async () => {
      screen.getByTestId('signout').click()
    })

    expect(mockSignOut).toHaveBeenCalled()
    expect(screen.getByTestId('user').textContent).toBe('none')
    expect(screen.getByTestId('profile').textContent).toBe('none')
  })

  it('refreshProfile fetches profile for current user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingle
      .mockResolvedValueOnce({
        data: { id: 'user-1', full_name: 'John', email: 'john@test.com', role: 'VOLUNTEER', status: 'ACTIVE', avatar_url: null, created_at: '', updated_at: '' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: 'user-1', full_name: 'John Updated', email: 'john@test.com', role: 'VOLUNTEER', status: 'ACTIVE', avatar_url: null, created_at: '', updated_at: '' },
        error: null,
      })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('profile').textContent).toBe('John')
    })

    await act(async () => {
      screen.getByTestId('refresh').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('profile').textContent).toBe('John Updated')
    })
  })

  it('unsubscribes on unmount', async () => {
    const mockUnsubscribe = vi.fn()
    mockOnAuthStateChange.mockImplementation((cb: typeof authStateCallback) => {
      authStateCallback = cb
      return { data: { subscription: { unsubscribe: mockUnsubscribe } } }
    })
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const { unmount } = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
    })

    unmount()
    expect(mockUnsubscribe).toHaveBeenCalled()
  })
})
