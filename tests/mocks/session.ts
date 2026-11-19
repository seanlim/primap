import type { Mock } from 'vitest'

type UserResult = { data?: { user?: { id?: string } | null } | null } | null

type MockedAuth = {
  getUser: Mock
  getClaims: Mock
}

/**
 * `lib/supabase/session.ts` verifies the session with `auth.getClaims()`.
 * Page tests stub the auth boundary through `auth.getUser()`, so mirror the
 * stubbed user into claims to keep those tests focused on rendering.
 */
export function stubClaimsFromUser(auth: MockedAuth) {
  auth.getClaims.mockImplementation(async () => {
    const getUser = auth.getUser as unknown as () => Promise<UserResult>
    const id = (await getUser())?.data?.user?.id

    return id
      ? { data: { claims: { sub: id } }, error: null }
      : { data: null, error: null }
  })
}
