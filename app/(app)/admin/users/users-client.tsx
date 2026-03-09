'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ChevronLeft, ChevronRight, Search, Users } from 'lucide-react'
import { approveUser, rejectUser, disableUser, enableUser, setUserRole } from '@/lib/actions/admin-user-actions'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'
import { ToastProvider, useToast } from '@/components/ui/toast'
import { EmptyState } from '@/components/ui/empty-state'
import type { UserRole } from '@/lib/types/database'
import type { UserStatus } from '@/lib/auth/access-policy'

interface UserData {
  id: string
  email: string
  fullName: string | null
  role: UserRole
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
}

const ACTION_LABELS: Record<ActionType, { title: string; message: (name: string) => string; confirm: string; destructive?: boolean }> = {
  approve: { title: 'Approve account?', message: (name) => `Approve ${name}'s account?`, confirm: 'Approve' },
  reject: { title: 'Reject account?', message: (name) => `Reject ${name}'s account?`, confirm: 'Reject', destructive: true },
  disable: { title: 'Disable account?', message: (name) => `Disable ${name}'s account?`, confirm: 'Disable', destructive: true },
  enable: { title: 'Enable account?', message: (name) => `Enable ${name}'s account?`, confirm: 'Enable' },
  promote: { title: 'Promote to admin?', message: (name) => `Grant admin role to ${name}?`, confirm: 'Promote' },
  demote: { title: 'Demote to volunteer?', message: (name) => `Remove admin role from ${name}?`, confirm: 'Demote', destructive: true },
}

function UsersContent({ users, currentPage, totalCount, pageSize, statusCounts }: UsersProps) {
  const [filter, setFilter] = useState<'all' | UserStatus>('all')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const router = useRouter()
  const { showToast } = useToast()
  const actionInFlightRef = useRef(false)

  const totalPages = Math.ceil(totalCount / pageSize)

  const filteredUsers = useMemo(() => {
    const byStatus = filter === 'all' ? users : users.filter((u) => u.status === filter)
    const normalized = query.trim().toLowerCase()
    if (!normalized) return byStatus

    return byStatus.filter((u) =>
      (u.fullName || '').toLowerCase().includes(normalized) ||
      u.email.toLowerCase().includes(normalized)
    )
  }, [users, filter, query])

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
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or email"
            className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-green-500"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto">
          {(['all', 'PENDING', 'ACTIVE', 'REJECTED', 'DISABLED'] as const).map((value) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                filter === value
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {value === 'all' ? `All (${totalCount})` : `${value} (${statusCounts[value]})`}
            </button>
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
            {filteredUsers.map((user) => (
              <div key={user.id} className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-900">{user.fullName || user.email}</p>
                    {user.fullName && <p className="text-sm text-gray-500">{user.email}</p>}
                    <p className="text-xs text-gray-400 mt-1">Created {new Date(user.createdAt).toLocaleDateString()}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        user.status === 'ACTIVE' ? 'bg-green-100 text-green-700'
                          : user.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                      }`}>
                        {user.status}
                      </span>
                      <span className="text-xs text-gray-400 capitalize">{user.role.toLowerCase()}</span>
                    </div>
                  </div>

                  <div className="flex gap-1 flex-shrink-0">
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
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <Link
              href={`/admin/users?page=${currentPage - 1}`}
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
              href={`/admin/users?page=${currentPage + 1}`}
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
