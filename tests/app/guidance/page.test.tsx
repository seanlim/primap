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
    expect(screen.getByText('Join A Walk')).toBeInTheDocument()
    expect(screen.getByText('Browse walks')).toBeInTheDocument()
    expect(screen.getByText('Take a look at currently available walks.')).toBeInTheDocument()
    expect(screen.getByText('Join a walk slot')).toBeInTheDocument()
    expect(screen.getByText('Open a slot and join if capacity holds.')).toBeInTheDocument()
    expect(screen.getByText('If you want to write report offline during the walk...')).toBeInTheDocument()
    expect(screen.getByText('Find the report for the walk')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /browse reports/i }).some((link) => link.getAttribute('href') === '/report')).toBe(true)
    expect(screen.getByText('Mark completion status')).toBeInTheDocument()
    expect(screen.getByText('Add sighting')).toBeInTheDocument()
    expect(screen.getByText('Record sightings of primates or other animals.')).toBeInTheDocument()
    expect(screen.getByText('Add additional notes')).toBeInTheDocument()
    expect(screen.getByText('Seen an incident?')).toBeInTheDocument()
    expect(screen.getByText('How do I submit a report with no sighting?')).toBeInTheDocument()
    expect(screen.getByText('Still Need Help?')).toBeInTheDocument()
    expect(screen.getByText('COMPLETED')).toBeInTheDocument()
    expect(screen.getByText('PARTIAL')).toBeInTheDocument()
    expect(screen.getByText('ABORTED')).toBeInTheDocument()
  })

  it('redirects unauthenticated users to login', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
    })

    await GuidancePage()

    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })
})
