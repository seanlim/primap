import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BottomNav } from '@/components/layout/bottom-nav'

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

describe('BottomNav', () => {
  it('renders 4 nav items for non-admin', () => {
    render(<BottomNav isAdmin={false} />)
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Walk')).toBeInTheDocument()
    expect(screen.getByText('Report')).toBeInTheDocument()
    expect(screen.getByText('Profile')).toBeInTheDocument()
    expect(screen.queryByText('Admin')).not.toBeInTheDocument()
  })

  it('renders 5 nav items for admin including Admin', () => {
    render(<BottomNav isAdmin={true} />)
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Walk')).toBeInTheDocument()
    expect(screen.getByText('Report')).toBeInTheDocument()
    expect(screen.getByText('Profile')).toBeInTheDocument()
    expect(screen.getByText('Admin')).toBeInTheDocument()
  })

  it('active link has green class when pathname matches', () => {
    // usePathname returns '/home' from global setup
    render(<BottomNav isAdmin={false} />)
    const homeLink = screen.getByText('Home').closest('a')
    expect(homeLink?.className).toContain('text-green-600')
  })

  it('non-active links have gray class', () => {
    // usePathname returns '/home', so /walk should be inactive
    render(<BottomNav isAdmin={false} />)
    const walkLink = screen.getByText('Walk').closest('a')
    expect(walkLink?.className).toContain('text-gray-400')
  })
})
