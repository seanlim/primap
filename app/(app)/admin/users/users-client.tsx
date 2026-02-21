'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { approveUser, rejectUser, disableUser, enableUser, setUserRole } from '@/lib/actions/admin-user-actions'

interface UserData {
  id: string
  email: string
  fullName: string | null
  role: string
  status: string
  createdAt: string
}

export function UsersClient({ users }: { users: UserData[] }) {
  const [filter, setFilter] = useState<string>('all')
  const [loading, setLoading] = useState<string | null>(null)
  const router = useRouter()

  const filteredUsers = filter === 'all'
    ? users
    : users.filter(u => u.status === filter)

  const handleAction = async (userId: string, action: () => Promise<{ error?: string }>) => {
    setLoading(userId)
    const result = await action()
    if (result.error) alert(result.error)
    else router.refresh()
    setLoading(null)
  }

  const statusCounts = {
    PENDING: users.filter(u => u.status === 'PENDING').length,
    ACTIVE: users.filter(u => u.status === 'ACTIVE').length,
    REJECTED: users.filter(u => u.status === 'REJECTED').length,
    DISABLED: users.filter(u => u.status === 'DISABLED').length,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto">
        {['all', 'PENDING', 'ACTIVE', 'REJECTED', 'DISABLED'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              filter === f
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f === 'all' ? `All (${users.length})` : `${f} (${statusCounts[f as keyof typeof statusCounts]})`}
          </button>
        ))}
      </div>

      {/* Users list */}
      <div className="space-y-2">
        {filteredUsers.map(user => (
          <div key={user.id} className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-gray-900">{user.fullName || user.email}</p>
                {user.fullName && <p className="text-sm text-gray-500">{user.email}</p>}
                <div className="flex items-center gap-2 mt-1">
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
                      onClick={() => handleAction(user.id, () => approveUser(user.id))}
                      disabled={loading === user.id}
                      className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleAction(user.id, () => rejectUser(user.id))}
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
                      onClick={() => handleAction(user.id, () =>
                        setUserRole(user.id, user.role === 'ADMIN' ? 'VOLUNTEER' : 'ADMIN')
                      )}
                      disabled={loading === user.id}
                      className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-200 disabled:opacity-50"
                    >
                      {user.role === 'ADMIN' ? 'Demote' : 'Promote'}
                    </button>
                    <button
                      onClick={() => handleAction(user.id, () => disableUser(user.id))}
                      disabled={loading === user.id}
                      className="text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-200 disabled:opacity-50"
                    >
                      Disable
                    </button>
                  </>
                )}
                {(user.status === 'DISABLED' || user.status === 'REJECTED') && (
                  <button
                    onClick={() => handleAction(user.id, () => enableUser(user.id))}
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
    </div>
  )
}
