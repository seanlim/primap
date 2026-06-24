import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isPublicPath, needsProfileCheck, resolveStatusRedirect } from '@/lib/auth/access-policy'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  const pathname = request.nextUrl.pathname

  if (pathname === '/api/cron/reminders') {
    return supabaseResponse
  }

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
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const requestIsPublicPath = isPublicPath(pathname)

  // Unauthenticated users can only access public paths
  if (!user && !requestIsPublicPath && pathname !== '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Authenticated users on login page should redirect to home,
  // unless they were redirected here due to profile fetch failure.
  const loginError = request.nextUrl.searchParams.get('error')
  if (user && pathname === '/login' && loginError !== 'profile_fetch_failed') {
    const url = request.nextUrl.clone()
    url.pathname = '/home'
    return NextResponse.redirect(url)
  }

  // Check account status for authenticated users across protected pages
  // and the status landing pages themselves.
  const profileCheckRequired = needsProfileCheck({
    hasUser: Boolean(user),
    pathname,
    isPublic: requestIsPublicPath,
  })

  if (profileCheckRequired) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('status, role')
      .eq('id', user!.id)
      .single()

    if (profileError) {
      console.error('Failed to fetch profile in middleware:', profileError)
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('error', 'profile_fetch_failed')
      return NextResponse.redirect(url)
    }

    if (!profile) {
      const url = request.nextUrl.clone()
      url.pathname = '/pending'
      return NextResponse.redirect(url)
    }

    const statusRedirect = resolveStatusRedirect(profile.status)
    if (statusRedirect && pathname !== statusRedirect) {
      const url = request.nextUrl.clone()
      url.pathname = statusRedirect
      return NextResponse.redirect(url)
    }

    if (pathname.startsWith('/admin') && profile.role !== 'ADMIN') {
      const url = request.nextUrl.clone()
      url.pathname = '/home'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
