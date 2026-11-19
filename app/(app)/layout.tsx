import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { ToastProvider } from '@/components/ui/toast'
import { requireSession, getCurrentProfile } from '@/lib/supabase/session'
import { needsPhoneCompletion, resolveStatusRedirect } from '@/lib/auth/access-policy'

export const dynamic = 'force-dynamic'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireSession()

  const [pathname, { profile, error }] = await Promise.all([
    headers().then((h) => h.get('x-pathname') ?? ''),
    getCurrentProfile(),
  ])

  if (error) {
    console.error('Failed to fetch profile in app layout:', error.message)
    if (error.code === 'PGRST116') redirect('/pending')
    redirect('/login?error=profile_fetch_failed')
  }

  if (!profile) redirect('/pending')

  const statusRedirect = resolveStatusRedirect(profile.status)
  if (statusRedirect && pathname !== statusRedirect) {
    redirect(statusRedirect)
  }

  if (
    needsPhoneCompletion({
      role: profile.role,
      status: profile.status,
      phoneNumber: profile.phone_number,
      pathname,
    })
  ) {
    redirect('/profile?phone=required')
  }

  const isAdmin = profile.role === 'ADMIN'

  return (
    <ToastProvider>
      <AppShell isAdmin={isAdmin}>{children}</AppShell>
    </ToastProvider>
  )
}
