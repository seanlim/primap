import { createClient } from '@/lib/supabase/server'
import { UsersClient } from './users-client'
import type { UserStatus } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page || '1', 10))
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const supabase = await createClient()

  const statuses: UserStatus[] = ['PENDING', 'ACTIVE', 'REJECTED', 'DISABLED']

  const [{ data: users }, { count: totalCount }, ...statusCountResults] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true }),
    ...statuses.map(s =>
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', s)
    ),
  ])

  const statusCounts = Object.fromEntries(
    statuses.map((s, i) => [s, statusCountResults[i].count || 0])
  ) as Record<UserStatus, number>

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
      currentPage={page}
      totalCount={totalCount || 0}
      pageSize={PAGE_SIZE}
      statusCounts={statusCounts}
    />
  )
}
