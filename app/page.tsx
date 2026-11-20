import { redirect } from 'next/navigation'
import { getSession } from '@/lib/supabase/session'

export const dynamic = 'force-dynamic'

export default async function RootPage() {
  const { userId } = await getSession()

  if (userId) {
    redirect('/home')
  } else {
    redirect('/login')
  }
}
