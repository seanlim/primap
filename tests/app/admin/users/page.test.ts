/**
 * Tests for AdminUsersPage server-side filtering and pagination.
 *
 * Verifies that:
 * - A valid ?status= param adds .eq('status', ...) to the users + totalCount queries
 * - Invalid/missing status param does NOT filter
 * - Page range is computed correctly
 * - Per-status count queries always run
 */

// Track every .eq() call across all query chains
const eqCalls: Array<{ chain: number; args: unknown[] }> = []
let chainCounter = 0

const { mockSupabase } = vi.hoisted(() => {
  const mockSupabase = { from: vi.fn() }
  return { mockSupabase }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
}))

vi.mock('../../../../app/(app)/admin/users/users-client', () => ({
  UsersClient: () => null,
}))

import AdminUsersPage from '../../../../app/(app)/admin/users/page'

function makeChain(index: number, resolvedValue: unknown) {
  const self: Record<string, unknown> = {}

  const fluent = (method: string) =>
    vi.fn((...args: unknown[]) => {
      if (method === 'eq') eqCalls.push({ chain: index, args })
      return self
    })

  self.select = fluent('select')
  self.eq = fluent('eq')
  self.order = fluent('order')
  self.range = vi.fn().mockResolvedValue(resolvedValue)

  // Make awaitable for count queries that return the chain directly (no .range)
  self.then = vi.fn((resolve: (v: unknown) => void) => {
    Promise.resolve().then(() => resolve(resolvedValue))
  })

  return self
}

function setupMock() {
  chainCounter = 0
  eqCalls.length = 0

  const usersResult = { data: [], error: null }
  const totalCountResult = { count: 100, error: null }
  const statusCountResults = [
    { count: 10, error: null },
    { count: 50, error: null },
    { count: 20, error: null },
    { count: 20, error: null },
  ]

  const chains: ReturnType<typeof makeChain>[] = []

  mockSupabase.from.mockImplementation(() => {
    const idx = chainCounter++
    let result: unknown
    if (idx === 0) result = usersResult
    else if (idx === 1) result = totalCountResult
    else result = statusCountResults[idx - 2] ?? { count: 0, error: null }

    const chain = makeChain(idx, result)
    chains[idx] = chain
    return chain
  })

  return { chains }
}

describe('AdminUsersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    chainCounter = 0
    eqCalls.length = 0
  })

  it('applies .eq("status", filter) on users and totalCount queries when status param is valid', async () => {
    setupMock()
    await AdminUsersPage({ searchParams: Promise.resolve({ status: 'PENDING' }) })

    // Chain 0 = users query, chain 1 = totalCount query
    const usersStatusEqs = eqCalls.filter((c) => c.chain === 0 && c.args[0] === 'status')
    const countStatusEqs = eqCalls.filter((c) => c.chain === 1 && c.args[0] === 'status')

    expect(usersStatusEqs).toHaveLength(1)
    expect(usersStatusEqs[0].args[1]).toBe('PENDING')
    expect(countStatusEqs).toHaveLength(1)
    expect(countStatusEqs[0].args[1]).toBe('PENDING')
  })

  it('does not apply status .eq on users/totalCount queries when no status param', async () => {
    setupMock()
    await AdminUsersPage({ searchParams: Promise.resolve({}) })

    const usersStatusEqs = eqCalls.filter((c) => c.chain === 0 && c.args[0] === 'status')
    const countStatusEqs = eqCalls.filter((c) => c.chain === 1 && c.args[0] === 'status')

    expect(usersStatusEqs).toHaveLength(0)
    expect(countStatusEqs).toHaveLength(0)
  })

  it('does not apply status .eq for invalid status param', async () => {
    setupMock()
    await AdminUsersPage({ searchParams: Promise.resolve({ status: 'BOGUS' }) })

    const usersStatusEqs = eqCalls.filter((c) => c.chain === 0 && c.args[0] === 'status')
    expect(usersStatusEqs).toHaveLength(0)
  })

  it('computes correct page range for page=2', async () => {
    const { chains } = setupMock()
    await AdminUsersPage({ searchParams: Promise.resolve({ page: '2' }) })

    // PAGE_SIZE=50, page 2 → from=50, to=99
    expect(chains[0].range).toHaveBeenCalledWith(50, 99)
  })

  it('clamps negative page to 1 (range 0-49)', async () => {
    const { chains } = setupMock()
    await AdminUsersPage({ searchParams: Promise.resolve({ page: '-3' }) })

    expect(chains[0].range).toHaveBeenCalledWith(0, 49)
  })

  it('always fetches per-status counts regardless of active filter', async () => {
    setupMock()
    await AdminUsersPage({ searchParams: Promise.resolve({ status: 'ACTIVE' }) })

    // Chains 2-5 are the per-status count queries
    const statuses = ['PENDING', 'ACTIVE', 'REJECTED', 'DISABLED']
    for (let i = 0; i < statuses.length; i++) {
      const calls = eqCalls.filter((c) => c.chain === i + 2 && c.args[0] === 'status')
      expect(calls).toHaveLength(1)
      expect(calls[0].args[1]).toBe(statuses[i])
    }
  })
})
