import { createClient } from '@/lib/supabase/server'
import { UsersClient } from './users-client'
import type { UserStatus } from '@/lib/auth/access-policy'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50
const ALL_STATUSES: UserStatus[] = ['PENDING', 'ACTIVE', 'REJECTED', 'DISABLED']

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const supabase = await createClient()

  const [{ data: users }, { count: totalCount }, ...statusResults] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true }),
    ...ALL_STATUSES.map(s =>
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', s)
    ),
  ])

  const statusCounts = Object.fromEntries(
    ALL_STATUSES.map((s, i) => [s, statusResults[i].count || 0])
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
