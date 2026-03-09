import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { AuthContext } from '@/lib/providers/auth-provider'
import { useAuth } from '@/lib/hooks/use-auth'

describe('useAuth', () => {
  it('returns context when wrapped in AuthContext.Provider', () => {
    const mockValue = {
      user: null,
      profile: null,
      loading: false,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
    }

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthContext.Provider value={mockValue}>{children}</AuthContext.Provider>
    )

    const { result } = renderHook(() => useAuth(), { wrapper })

    expect(result.current.user).toBeNull()
    expect(result.current.profile).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.signOut).toBe(mockValue.signOut)
    expect(result.current.refreshProfile).toBe(mockValue.refreshProfile)
  })

  it('throws error when used outside provider', () => {
    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth must be used within an AuthProvider'
    )
  })
})
