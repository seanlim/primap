import { vi } from 'vitest'

/**
 * Creates a chainable mock Supabase client.
 * Each query-builder method returns `this` for chaining.
 * Terminal methods (single, etc.) return configurable results.
 *
 * Usage:
 *   const { client, methods } = createMockSupabaseClient()
 *   methods.single.mockResolvedValueOnce({ data: {...}, error: null })
 */
export function createMockSupabaseClient() {
  const methods = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    upsert: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    in: vi.fn(),
    limit: vi.fn(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  }

  // Make each chainable method return the methods object
  for (const key of Object.keys(methods) as (keyof typeof methods)[]) {
    if (key !== 'single') {
      methods[key].mockReturnThis()
    }
  }

  // Override single so it is also part of the chain object
  const chain = methods as typeof methods & { from: ReturnType<typeof vi.fn> }
  chain.from = vi.fn().mockReturnValue(methods)

  const client = {
    from: chain.from,
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      signOut: vi.fn().mockResolvedValue({}),
      exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    storage: {
      from: vi.fn().mockReturnValue({
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: 'https://example.com/public/file.jpg' },
        }),
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: 'https://example.com/signed/file.jpg' },
          error: null,
        }),
        upload: vi.fn().mockResolvedValue({ error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      }),
    },
  }

  return { client, methods, chain }
}

/**
 * Helper to configure a mock supabase chain to return data for a specific query.
 * Sets up the terminal `.single()` to resolve with given data/error.
 */
export function mockQueryResult(
  methods: ReturnType<typeof createMockSupabaseClient>['methods'],
  data: unknown,
  error: { message: string; code?: string } | null = null
) {
  methods.single.mockResolvedValueOnce({ data, error })
}
