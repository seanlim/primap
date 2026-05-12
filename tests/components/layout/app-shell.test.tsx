import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppShell } from '@/components/layout/app-shell'
import { useIsDesktop } from '@/lib/hooks/use-media-query'

vi.mock('@/lib/hooks/use-media-query', () => ({
  useIsDesktop: vi.fn(),
}))

vi.mock('@/components/layout/sidebar-nav', () => ({
  SidebarNav: ({ isAdmin }: { isAdmin: boolean }) => (
    <aside data-testid="sidebar-nav">sidebar:{String(isAdmin)}</aside>
  ),
}))

vi.mock('@/components/layout/bottom-nav', () => ({
  BottomNav: ({ isAdmin }: { isAdmin: boolean }) => (
    <nav data-testid="bottom-nav">bottom:{String(isAdmin)}</nav>
  ),
}))

const mockedUseIsDesktop = vi.mocked(useIsDesktop)

describe('AppShell', () => {
  it('renders the original desktop shell with sidebar and no bottom nav', () => {
    mockedUseIsDesktop.mockReturnValue(true)

    render(
      <AppShell isAdmin={true}>
        <div>Page content</div>
      </AppShell>
    )

    expect(screen.getByTestId('sidebar-nav')).toHaveTextContent('sidebar:true')
    expect(screen.queryByTestId('bottom-nav')).not.toBeInTheDocument()
    expect(screen.getByText('Page content').closest('main')).toHaveClass('ml-64', 'min-h-screen')
    expect(screen.getByText('Page content').parentElement).toHaveClass('max-w-4xl', 'mx-auto', 'p-6')
  })

  it('renders the original mobile shell with bottom nav and no sidebar', () => {
    mockedUseIsDesktop.mockReturnValue(false)

    render(
      <AppShell isAdmin={true}>
        <div>Page content</div>
      </AppShell>
    )

    expect(screen.queryByTestId('sidebar-nav')).not.toBeInTheDocument()
    expect(screen.getByTestId('bottom-nav')).toHaveTextContent('bottom:true')
    expect(screen.getByText('Page content').closest('main')).toHaveClass('pb-20', 'min-h-screen')
    expect(screen.getByText('Page content').parentElement).toHaveClass('max-w-lg', 'mx-auto', 'p-4')
  })
})
