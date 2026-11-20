import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isPublicPath } from '@/lib/auth/access-policy'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (pathname === '/api/cron/reminders') {
    return NextResponse.next({ request })
  }

  // App Router layouts don't receive the pathname, so forward it as a request
  // header for the account-status checks in app/(app)/layout.tsx.
  const forwardedHeaders = () => {
    const headers = new Headers(request.headers)
    headers.set('x-pathname', pathname)
    return headers
  }

  let supabaseResponse = NextResponse.next({ request: { headers: forwardedHeaders() } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })
          supabaseResponse = NextResponse.next({ request: { headers: forwardedHeaders() } })
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Verify the JWT locally against the cached JWKS instead of calling the Auth
  // server on every request. Only an expired token needs the network, because
  // refreshing it has to write new cookies back onto the response.
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  let userId: string | null = claimsData?.claims?.sub ?? null

  if (!userId && claimsError) {
    const { data: userData } = await supabase.auth.getUser()
    userId = userData.user?.id ?? null
  }

  const requestIsPublicPath = isPublicPath(pathname)

  // Unauthenticated users can only access public paths
  if (!userId && !requestIsPublicPath && pathname !== '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Authenticated users on login page should redirect to home,
  // unless they were redirected here due to profile fetch failure.
  const loginError = request.nextUrl.searchParams.get('error')
  if (userId && pathname === '/login' && loginError !== 'profile_fetch_failed') {
    const url = request.nextUrl.clone()
    url.pathname = '/home'
    return NextResponse.redirect(url)
  }

  // Account status, phone completion and admin gating live in
  // app/(app)/layout.tsx, which needs the profile row anyway. Doing the profile
  // query here duplicated it in the layout and page and added two sequential
  // database round trips to every request (including RSC prefetches).
  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
