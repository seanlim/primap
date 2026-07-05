'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ChevronLeft, ChevronRight, Phone, Search, Users } from 'lucide-react'
import { approveUser, rejectUser, disableUser, enableUser, setUserRole } from '@/lib/actions/admin-user-actions'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'
import { ToastProvider, useToast } from '@/components/ui/toast'
import { EmptyState } from '@/components/ui/empty-state'
import type { Enums } from '@/lib/types/database'
import type { UserStatus } from '@/lib/auth/access-policy'
import type { AdminUsersAnalyticsSnapshot } from '@/lib/admin-volunteer-analytics'
import { isProfileContactComplete } from '@/lib/auth/contact-profile'

interface UserData {
  id: string
  email: string
  fullName: string | null
  phoneNumber: string | null
  phoneVerifiedAt: string | null
  birthMonth: string | null
  role: Enums<'user_role'>
  status: UserStatus
  createdAt: string
}

type ActionType = 'approve' | 'reject' | 'disable' | 'enable' | 'promote' | 'demote'

interface PendingAction {
  userId: string
  userLabel: string
  action: ActionType
}

interface UsersProps {
  users: UserData[]
  currentPage: number
  totalCount: number
  pageSize: number
  statusCounts: Record<UserStatus, number>
  activeFilter: UserStatus | null
  activeRoleFilter?: 'VOLUNTEER' | 'ADMIN' | null
  analytics?: AdminUsersAnalyticsSnapshot
}

const ACTION_LABELS: Record<ActionType, { title: string; message: (name: string) => string; confirm: string; destructive?: boolean }> = {
  approve: { title: 'Approve account?', message: (name) => `Approve ${name}'s account?`, confirm: 'Approve' },
  reject: { title: 'Reject account?', message: (name) => `Reject ${name}'s account?`, confirm: 'Reject', destructive: true },
  disable: { title: 'Disable account?', message: (name) => `Disable ${name}'s account?`, confirm: 'Disable', destructive: true },
  enable: { title: 'Enable account?', message: (name) => `Enable ${name}'s account?`, confirm: 'Enable' },
  promote: { title: 'Promote to admin?', message: (name) => `Grant admin role to ${name}?`, confirm: 'Promote' },
  demote: { title: 'Demote to volunteer?', message: (name) => `Remove admin role from ${name}?`, confirm: 'Demote', destructive: true },
}

function UsersContent({ users, currentPage, totalCount, pageSize, statusCounts, activeFilter, activeRoleFilter, analytics }: UsersProps) {
  const filter: 'all' | UserStatus = activeFilter ?? 'all'
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState<'default' | 'participations' | 'submissions' | 'cancellations'>('default')
  const [indicatorFilter, setIndicatorFilter] = useState<'ALL' | 'HIGH' | 'LATE'>('ALL')
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'VOLUNTEER' | 'ADMIN'>(activeRoleFilter ?? 'ALL')
  const [loading, setLoading] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const router = useRouter()
  const { showToast } = useToast()
  const actionInFlightRef = useRef(false)

  const totalPages = Math.ceil(totalCount / pageSize)

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    const searched = !normalized ? users : users.filter((u) =>
      (u.fullName || '').toLowerCase().includes(normalized) ||
      u.email.toLowerCase().includes(normalized) ||
      (u.phoneNumber || '').toLowerCase().includes(normalized)
    )
    const indicatorFiltered = indicatorFilter === 'ALL'
      ? searched
      : searched.filter((user) => {
        const stats = analytics?.userStats[user.id]
        return indicatorFilter === 'HIGH'
          ? Boolean(stats?.hasHighParticipationIndicator)
          : Boolean(stats?.hasLateCancellationIndicator)
      })

    return [...indicatorFiltered].sort((left, right) => {
      if (sortBy === 'default') {
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      }
      const leftStats = analytics?.userStats[left.id] ?? { participations: 0, submissions: 0, cancellations: 0 }
      const rightStats = analytics?.userStats[right.id] ?? { participations: 0, submissions: 0, cancellations: 0 }
      const diff = rightStats[sortBy] - leftStats[sortBy]
      if (diff !== 0) return diff
      return (left.fullName || left.email).localeCompare(right.fullName || right.email)
    })
  }, [analytics?.userStats, indicatorFilter, query, sortBy, users])

  const buildUsersHref = (next: { page?: number; status?: 'all' | UserStatus; role?: 'ALL' | 'VOLUNTEER' | 'ADMIN' }) => {
    const params = new URLSearchParams()
    const nextStatus = next.status ?? filter
    const nextRole = next.role ?? roleFilter
    const nextPage = next.page ?? currentPage

    if (nextPage > 1) params.set('page', String(nextPage))
    if (nextStatus !== 'all') params.set('status', nextStatus)
    if (nextRole !== 'ALL') params.set('role', nextRole)

    const queryString = params.toString()
    return queryString ? `/admin/users?${queryString}` : '/admin/users'
  }

  const requestAction = (userId: string, userLabel: string, action: ActionType) =>
    setPendingAction({ userId, userLabel, action })

  const runAction = async (action: PendingAction) => {
    if (actionInFlightRef.current) return

    actionInFlightRef.current = true
    setLoading(action.userId)
    setPendingAction(null)

    const result: { error?: string } = await (async () => {
      switch (action.action) {
        case 'approve':
          return approveUser(action.userId)
        case 'reject':
          return rejectUser(action.userId)
        case 'disable':
          return disableUser(action.userId)
        case 'enable':
          return enableUser(action.userId)
        case 'promote':
          return setUserRole(action.userId, 'ADMIN')
        case 'demote':
          return setUserRole(action.userId, 'VOLUNTEER')
        default: {
          const _exhaustive: never = action.action
          throw new Error(`Unhandled action: ${_exhaustive}`)
        }
      }
    })()

    if (result.error) {
      showToast(result.error, 'error')
    } else {
      showToast('User updated successfully.', 'success')
    }

    setLoading(null)
    actionInFlightRef.current = false
    router.refresh()
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name or email"
              className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-green-500"
            />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Sort By</label>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="default">Default</option>
                <option value="participations">Participations</option>
                <option value="submissions">Submissions</option>
                <option value="cancellations">Cancellations</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1" htmlFor="indicator-filter">Indicator</label>
              <select
                id="indicator-filter"
                value={indicatorFilter}
                onChange={(event) => setIndicatorFilter(event.target.value as typeof indicatorFilter)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="ALL">All indicators</option>
                <option value="HIGH">High participation</option>
                <option value="LATE">Late cancellation</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
              <select
                value={roleFilter}
                onChange={(event) => {
                  const nextRole = event.target.value as typeof roleFilter
                  setRoleFilter(nextRole)
                  router.push(buildUsersHref({ role: nextRole, page: 1 }))
                }}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="ALL">All roles</option>
                <option value="VOLUNTEER">Volunteer</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto">
          {(['all', 'PENDING', 'ACTIVE', 'REJECTED', 'DISABLED'] as const).map((value) => (
            <Link
              key={value}
              href={buildUsersHref({ status: value, page: 1 })}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                filter === value
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {value === 'all'
                ? `All (${Object.values(statusCounts).reduce((a, b) => a + b, 0)})`
                : `${value} (${statusCounts[value]})`}
            </Link>
          ))}
        </div>

        {users.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No users found"
            description="No profile records are available yet."
          />
        ) : filteredUsers.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No matching users"
            description="Try a different name, email, or status filter."
          />
        ) : (
          <div className="space-y-2">
            {filteredUsers.map((user) => {
              const stats = analytics?.userStats[user.id]
              const contactComplete = isProfileContactComplete({
                phone_number: user.phoneNumber,
                phone_verified_at: user.phoneVerifiedAt,
                birth_month: user.birthMonth,
              })

              return (
              <div key={user.id} className="overflow-hidden rounded-xl bg-white shadow-sm">
                <div className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
	                    <p className="font-medium text-gray-900">{user.fullName || user.email}</p>
	                    {user.fullName && <p className="truncate text-sm text-gray-500">{user.email}</p>}
	                    <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-gray-500">
	                      <Phone className="h-3.5 w-3.5 shrink-0" />
	                      {user.phoneNumber || 'No phone on file'}
	                    </p>
	                    <p className="mt-1 text-xs text-gray-400">Created {new Date(user.createdAt).toLocaleDateString()}</p>
	                    <div className="mt-2 flex items-center gap-2">
	                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        user.status === 'ACTIVE' ? 'bg-green-100 text-green-700'
                          : user.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                      }`}>
	                        {user.status}
	                      </span>
	                      <span className="text-xs text-gray-400 capitalize">{user.role.toLowerCase()}</span>
	                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
	                        contactComplete ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
	                      }`}>
	                        {contactComplete ? 'Contact complete' : 'Missing contact'}
	                      </span>
	                    </div>
	                  </div>

                  <div className="flex shrink-0 gap-1">
                    {user.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => requestAction(user.id, user.fullName || user.email, 'approve')}
                          disabled={loading === user.id}
                          className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => requestAction(user.id, user.fullName || user.email, 'reject')}
                          disabled={loading === user.id}
                          className="text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-200 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {user.status === 'ACTIVE' && (
                      <>
                        <button
                          onClick={() => requestAction(user.id, user.fullName || user.email, user.role === 'ADMIN' ? 'demote' : 'promote')}
                          disabled={loading === user.id}
                          className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-200 disabled:opacity-50"
                        >
                          {user.role === 'ADMIN' ? 'Demote' : 'Promote'}
                        </button>
                        <button
                          onClick={() => requestAction(user.id, user.fullName || user.email, 'disable')}
                          disabled={loading === user.id}
                          className="text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-200 disabled:opacity-50"
                        >
                          Disable
                        </button>
                      </>
                    )}
                    {(user.status === 'DISABLED' || user.status === 'REJECTED') && (
                      <button
                        onClick={() => requestAction(user.id, user.fullName || user.email, 'enable')}
                        disabled={loading === user.id}
                        className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-200 disabled:opacity-50"
                      >
                        Enable
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 divide-x divide-gray-200 border-t border-gray-200">
                  <div
                    className={`px-4 py-3 text-xs ${
                      (analytics?.userStats[user.id]?.participations ?? 0) > 0
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-500'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                      <span className="font-semibold">
                        {stats?.participations ?? 0}
                      </span>{' '}
                      <span>participations</span>
                      {stats?.hasHighParticipationIndicator && (
                        <span className="inline-flex rounded-lg bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                          High
                        </span>
                      )}
                    </div>
                  </div>
                  <div
                    className={`px-4 py-3 text-xs ${
                      (analytics?.userStats[user.id]?.participations ?? 0) === 0
                        ? 'text-gray-500'
                        : (analytics?.userStats[user.id]?.submissions ?? 0) === (analytics?.userStats[user.id]?.participations ?? 0)
                        ? 'bg-green-50 text-green-700'
                        : 'bg-orange-50 text-orange-700'
                    }`}
                  >
                    <span className="font-semibold">
                      {analytics?.userStats[user.id]?.submissions ?? 0}
                    </span>{' '}
                    submissions
                  </div>
                  <div
                    className={`px-4 py-3 text-xs ${
                      (analytics?.userStats[user.id]?.cancellations ?? 0) > 0
                        ? 'bg-red-50 text-red-700'
                        : 'text-gray-500'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                      <span className="font-semibold">
                        {stats?.cancellations ?? 0}
                      </span>
                      <span>cancellations</span>
                      {stats?.hasLateCancellationIndicator && (
                        <span className="inline-flex rounded-lg bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                          Late ({stats.lateCancellations})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              )
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <Link
              href={buildUsersHref({ page: currentPage - 1 })}
              className={`flex items-center gap-1 text-sm font-medium px-3 py-2 rounded-lg transition-colors ${
                currentPage <= 1
                  ? 'text-gray-300 pointer-events-none'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
              aria-disabled={currentPage <= 1}
              tabIndex={currentPage <= 1 ? -1 : undefined}
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Link>
            <span className="text-sm text-gray-500">
              Page {currentPage} of {totalPages}
            </span>
            <Link
              href={buildUsersHref({ page: currentPage + 1 })}
              className={`flex items-center gap-1 text-sm font-medium px-3 py-2 rounded-lg transition-colors ${
                currentPage >= totalPages
                  ? 'text-gray-300 pointer-events-none'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
              aria-disabled={currentPage >= totalPages}
              tabIndex={currentPage >= totalPages ? -1 : undefined}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>

      <ConfirmationDialog
        open={Boolean(pendingAction)}
        title={pendingAction ? ACTION_LABELS[pendingAction.action].title : ''}
        message={pendingAction ? ACTION_LABELS[pendingAction.action].message(pendingAction.userLabel) : ''}
        confirmLabel={pendingAction ? ACTION_LABELS[pendingAction.action].confirm : 'Confirm'}
        destructive={pendingAction ? Boolean(ACTION_LABELS[pendingAction.action].destructive) : false}
        onCancel={() => {
          if (loading) return
          setPendingAction(null)
        }}
        onConfirm={() => pendingAction && runAction(pendingAction)}
        busy={Boolean(loading)}
      />
    </>
  )
}

export function UsersClient(props: UsersProps) {
  return (
    <ToastProvider>
      <UsersContent {...props} />
    </ToastProvider>
  )
}
