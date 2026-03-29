import { render, screen } from '@testing-library/react'

const { mockSupabase } = vi.hoisted(() => {
  const mockSupabase = { from: vi.fn() }
  return { mockSupabase }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
}))

import AdminDashboard from '../../../app/(app)/admin/page'

function makeAwaitableChain(resolvedValue: unknown) {
  const self: Record<string, unknown> = {}
  const fluent = vi.fn(() => self)
  self.select = fluent
  self.eq = fluent
  self.then = vi.fn((resolve: (value: unknown) => void) => {
    Promise.resolve().then(() => resolve(resolvedValue))
  })
  return self
}

describe('AdminDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the analytics card for admins', async () => {
    const results = [
      { count: 12, error: null },
      { count: 2, error: null },
      { count: 1, error: null },
      { count: 8, error: null },
      { count: 15, error: null },
      { count: 0, error: null },
    ]

    let index = 0
    mockSupabase.from.mockImplementation(() => makeAwaitableChain(results[index++]))

    render(await AdminDashboard())

    const link = screen.getByRole('link', { name: /Analytics - Volunteers/i })
    expect(link).toHaveAttribute('href', '/admin/analytics')
  })
})
