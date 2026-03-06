import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/auth/callback', '/pending', '/blocked'] as const

function matchesPath(pathname: string, basePath: string) {
  return pathname === basePath || pathname.startsWith(`${basePath}/`)
}

function resolveStatusRedirect(status: 'PENDING' | 'REJECTED' | 'DISABLED' | 'ACTIVE') {
  if (status === 'PENDING') return '/pending'
  if (status === 'REJECTED' || status === 'DISABLED') return '/blocked'
  return null
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

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
  const pathname = request.nextUrl.pathname

  const isPublicPath = PUBLIC_PATHS.some(p => matchesPath(pathname, p))

  // Unauthenticated users can only access public paths
  if (!user && !isPublicPath && pathname !== '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Authenticated users on login page should redirect to home
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/home'
    return NextResponse.redirect(url)
  }

  // Check account status for authenticated users across protected pages
  // and the status landing pages themselves.
  const needsProfileCheck = user && pathname !== '/' && (
    !isPublicPath || pathname === '/pending' || pathname === '/blocked'
  )

  if (needsProfileCheck) {
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
