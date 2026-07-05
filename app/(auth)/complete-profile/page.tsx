import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isProfileContactComplete } from '@/lib/auth/contact-profile'
import { CompleteProfileClient } from './complete-profile-client'

export const dynamic = 'force-dynamic'

function resolveNextPath(status: string, requested?: string): string {
  if (status === 'PENDING') return '/pending'
  if (requested && requested.startsWith('/') && !requested.startsWith('//') && requested !== '/complete-profile') {
    return requested
  }
  return '/home'
}

export default async function CompleteProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, status, phone_number, phone_verified_at, birth_month')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/pending')
  if (profile.status === 'REJECTED' || profile.status === 'DISABLED') redirect('/blocked')

  const nextPath = resolveNextPath(profile.status, params.next)
  if (isProfileContactComplete(profile)) redirect(nextPath)

  return (
    <CompleteProfileClient
      nextPath={nextPath}
      profile={{
        id: profile.id,
        email: profile.email,
        fullName: profile.full_name,
        role: profile.role,
        status: profile.status,
        phoneNumber: profile.phone_number,
        phoneVerifiedAt: profile.phone_verified_at,
        birthMonth: profile.birth_month,
      }}
    />
  )
}
