import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SidebarNav } from '@/components/layout/sidebar-nav'
import { useAuth } from '@/lib/hooks/use-auth'

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('@/lib/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}))

const mockedUseAuth = vi.mocked(useAuth)

describe('SidebarNav', () => {
  it('shows Admin link when isAdmin is true', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      profile: null,
      loading: false,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
    })

    render(<SidebarNav isAdmin={true} />)
    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument()
  })

  it('hides Admin section when isAdmin is false', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      profile: null,
      loading: false,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
    })

    render(<SidebarNav isAdmin={false} />)
    expect(screen.queryByText('Admin Dashboard')).not.toBeInTheDocument()
    expect(screen.queryByText('Admin')).not.toBeInTheDocument()
  })

  it('shows user avatar initial from full_name', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      profile: { full_name: 'Jane Doe', email: 'jane@example.com' } as any,
      loading: false,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
    })

    render(<SidebarNav isAdmin={false} />)
    expect(screen.getByText('J')).toBeInTheDocument()
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
  })

  it('shows ? when no profile info available', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      profile: null,
      loading: false,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
    })

    render(<SidebarNav isAdmin={false} />)
    expect(screen.getByText('?')).toBeInTheDocument()
  })
})
