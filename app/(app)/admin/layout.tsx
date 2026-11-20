import { redirect } from 'next/navigation'
import { requireSession, getCurrentProfile } from '@/lib/supabase/session'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireSession()

  // Cached per render: app/(app)/layout.tsx already read this profile, so the
  // admin guard adds no extra database round trip.
  const { profile } = await getCurrentProfile()
  if (profile?.role !== 'ADMIN') redirect('/home')

  return <>{children}</>
}
