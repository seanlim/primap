import { render, screen } from '@testing-library/react'

const { mockSupabase, mockRedirect } = vi.hoisted(() => {
  const mockSupabase = {
    auth: {
      getUser: vi.fn(),
    },
  }
  const mockRedirect = vi.fn()
  return { mockSupabase, mockRedirect }
})

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
}))

vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<typeof import('next/navigation')>('next/navigation')
  return {
    ...actual,
    redirect: (...args: unknown[]) => mockRedirect(...args),
  }
})

import GuidancePage from '@/app/(app)/guidance/page'

describe('GuidancePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders compact beginner guidance with volunteer terminology', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    })

    render(await GuidancePage())

    expect(screen.getAllByText('Beginner Guide').length).toBeGreaterThan(0)
    expect(screen.getByText('Getting Started')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to home/i })).toHaveAttribute('href', '/home')
    expect(screen.getByText('Browse available walks')).toBeInTheDocument()
    expect(screen.getByText('Open a slot and join if available')).toBeInTheDocument()
    expect(screen.getByText('If you want to write report offline during the walk...')).toBeInTheDocument()
    expect(screen.getByText('Mark completion status')).toBeInTheDocument()
    expect(screen.getByText('Add sighting if sighted')).toBeInTheDocument()
    expect(screen.getByText('Add additional notes')).toBeInTheDocument()
    expect(screen.getByText('Seen an incident?')).toBeInTheDocument()
    expect(screen.getByText('Reports')).toBeInTheDocument()
    expect(screen.getByText('Edit Report')).toBeInTheDocument()
    expect(screen.getAllByText('View Reports').length).toBeGreaterThan(0)
    expect(screen.getByText('How do I submit a report with no sighting?')).toBeInTheDocument()
    expect(screen.getByText('Still Need Help?')).toBeInTheDocument()
    expect(screen.getByText('COMPLETED')).toBeInTheDocument()
    expect(screen.getByText('PARTIAL')).toBeInTheDocument()
    expect(screen.getByText('ABORTED')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /browse walks/i })).toHaveAttribute('href', '/walk')
    expect(screen.getAllByRole('link', { name: /view reports/i })[0]).toHaveAttribute('href', '/report')
  })

  it('redirects unauthenticated users to login', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
    })

    await GuidancePage()

    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })
})
