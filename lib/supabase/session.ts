import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from './server'
import type { Tables } from '@/lib/types/database'

/**
 * Per-request auth helpers.
 *
 * Every server component used to build its own Supabase client and call
 * `auth.getUser()` (a network round trip to the Auth server) plus a profile
 * query. React's `cache()` dedupes these lookups for the duration of a single
 * render, so a layout and its page now share one session read and one profile
 * read instead of repeating them.
 *
 * `getClaims()` verifies the JWT locally against the project's JWKS (fetched
 * once and cached). It only falls back to a network call when the project still
 * uses the legacy symmetric signing key.
 */

export type SessionProfile = Pick<Tables<'profiles'>, 'id' | 'status' | 'role' | 'phone_number'>

export type ProfileLookup = {
  profile: SessionProfile | null
  error: { code?: string; message: string } | null
}

export const getSession = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const subject = data?.claims?.sub

  return {
    supabase,
    userId: typeof subject === 'string' ? subject : null,
  }
})

/** Redirects unauthenticated visitors to /login. */
export const requireSession = cache(async () => {
  const session = await getSession()
  if (!session.userId) redirect('/login')
  return { supabase: session.supabase, userId: session.userId }
})

export const getCurrentProfile = cache(async (): Promise<ProfileLookup> => {
  const { supabase, userId } = await getSession()
  if (!userId) return { profile: null, error: null }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, status, role, phone_number')
    .eq('id', userId)
    .single()

  return {
    profile: data,
    error: error ? { code: error.code, message: error.message } : null,
  }
})
