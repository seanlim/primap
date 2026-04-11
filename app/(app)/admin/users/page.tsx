import { createClient } from '@/lib/supabase/server'
import { UsersClient } from './users-client'
import type { UserStatus } from '@/lib/auth/access-policy'
import { getAdminUsersAnalytics, type SupabaseClientLike } from '@/lib/admin-volunteer-analytics'
import {
  DEFAULT_HIGH_PARTICIPATION_THRESHOLD,
  DEFAULT_LATE_CANCEL_HOURS,
} from '@/lib/constants/settings'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50
const ALL_STATUSES: UserStatus[] = ['PENDING', 'ACTIVE', 'REJECTED', 'DISABLED']
const ALL_ROLES = ['VOLUNTEER', 'ADMIN'] as const
type UserRoleFilter = (typeof ALL_ROLES)[number]

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; sort?: string; role?: string }>
}) {
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)
  const statusFilter = ALL_STATUSES.includes(params.status as UserStatus)
    ? (params.status as UserStatus)
    : null
  const roleFilter = ALL_ROLES.includes(params.role as UserRoleFilter)
    ? (params.role as UserRoleFilter)
    : null
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const supabase = await createClient()
  const analyticsClient = supabase as unknown as SupabaseClientLike

  const [{ data: users }, { count: totalCount }, { data: settings }, ...statusResults] = await Promise.all([
    (() => {
      let q = supabase.from('profiles').select('*').order('created_at', { ascending: false })
      if (statusFilter) q = q.eq('status', statusFilter)
      if (roleFilter) q = q.eq('role', roleFilter)
      return q.range(from, to)
    })(),
    (() => {
      let q = supabase.from('profiles').select('id', { count: 'exact', head: true })
      if (statusFilter) q = q.eq('status', statusFilter)
      if (roleFilter) q = q.eq('role', roleFilter)
      return q
    })(),
    supabase
      .from('app_settings')
      .select('late_cancel_hours, high_participation_threshold')
      .limit(1)
      .single(),
    ...ALL_STATUSES.map(s =>
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', s)
    ),
  ])

  const statusCounts = Object.fromEntries(
    ALL_STATUSES.map((s, i) => [s, statusResults[i].count || 0])
  ) as Record<UserStatus, number>

  const userRows = (users || []).map(u => ({
    id: u.id,
    email: u.email,
    fullName: u.full_name,
    role: u.role,
    status: u.status,
    createdAt: u.created_at,
  }))

  const analytics = await getAdminUsersAnalytics(
    analyticsClient,
    userRows.map((user) => user.id),
    {
      lateCancelHours: settings?.late_cancel_hours ?? DEFAULT_LATE_CANCEL_HOURS,
      highParticipationThreshold: settings?.high_participation_threshold ?? DEFAULT_HIGH_PARTICIPATION_THRESHOLD,
    }
  )

  return (
    <UsersClient
      users={userRows}
      currentPage={page}
      totalCount={totalCount || 0}
      pageSize={PAGE_SIZE}
      statusCounts={statusCounts}
      activeFilter={statusFilter}
      activeRoleFilter={roleFilter}
      analytics={analytics}
    />
  )
}
