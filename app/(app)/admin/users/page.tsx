import { createClient } from '@/lib/supabase/server'
import { UsersClient } from './users-client'

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
  const supabase = await createClient()

  const { data: users } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <UsersClient
      users={(users || []).map(u => ({
        id: u.id,
        email: u.email,
        fullName: u.full_name,
        role: u.role,
        status: u.status,
        createdAt: u.created_at,
      }))}
    />
  )
}
