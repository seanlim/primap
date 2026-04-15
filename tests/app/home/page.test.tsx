import { render, screen } from '@testing-library/react'

const { mockSupabase, mockRedirect } = vi.hoisted(() => {
  const mockSupabase = {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
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

import HomePage from '@/app/(app)/home/page'

function createQuery(result: { data?: unknown; count?: number | null; error?: { message: string } | null }) {
  const query = {
    eq: vi.fn(() => query),
    gte: vi.fn(() => query),
    in: vi.fn(() => query),
    single: vi.fn().mockResolvedValue({
      data: result.data ?? null,
      error: result.error ?? null,
      count: result.count ?? null,
    }),
    then: vi.fn((resolve: (value: unknown) => unknown) =>
      Promise.resolve(resolve({
        data: result.data ?? null,
        error: result.error ?? null,
        count: result.count ?? null,
      }))
    ),
  }

  return query
}

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-14T12:00:00+08:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the guidance entry point from home', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    })

    const tableResults: Record<string, Array<{ data?: unknown; count?: number | null }>> = {
      profiles: [
        {
          data: {
            id: 'user-1',
            full_name: 'Volunteer One',
          },
        },
      ],
      slot_memberships: [
        { data: [] },
      ],
      observations: [
        { count: 0 },
      ],
    }

    const callCounts = new Map<string, number>()

    mockSupabase.from.mockImplementation((table: string) => ({
      select: () => {
        const index = callCounts.get(table) ?? 0
        callCounts.set(table, index + 1)
        const result = tableResults[table]?.[index]
        if (!result) throw new Error(`Unexpected query for table ${table} at call ${index + 1}`)
        return createQuery(result)
      },
    }))

    render(await HomePage())

    expect(screen.getByText('New here?')).toBeInTheDocument()
    expect(screen.getByText('Read beginner guide')).toBeInTheDocument()
    expect(screen.getByText('Learn how to sign up, join a walk, and submit your first report.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /new here\?.*read beginner guide/i })).toHaveAttribute('href', '/guidance')
  })
})
