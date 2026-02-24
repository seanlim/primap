'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LogOut, Check, Pencil } from 'lucide-react'
import { updateProfile } from '@/lib/actions/profile-actions'
import { signOut } from '@/lib/actions/auth-actions'
import { createClient } from '@/lib/supabase/client'

interface Props {
  profile: {
    id: string
    email: string
    fullName: string | null
    avatarUrl: string | null
    role: string
    status: string
    createdAt: string
  }
  stats: {
    walksJoined: number
    reportsSubmitted: number
    draftsPending: number
    requiredWalks: number
  }
  walkHistory: {
    membershipId: string
    slotId: string
    locationName: string
    walkDate: string
    startTime: string
    roundName: string
    reportStatus: string
    sightingCount: number
  }[]
}

export function ProfileClient({ profile, stats, walkHistory }: Props) {
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(profile.fullName || '')
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  const handleSaveName = async () => {
    setSaving(true)
    await updateProfile(name)
    setEditingName(false)
    setSaving(false)
    router.refresh()
  }

  const handleSignOut = async () => {
    await signOut()
  }

  const progressPercent = Math.min((stats.reportsSubmitted / stats.requiredWalks) * 100, 100)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Profile</h1>

      {/* Profile Info */}
      <div className="bg-white rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-xl font-bold text-green-700">
              {(profile.fullName || profile.email)[0].toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  autoFocus
                />
                <button
                  onClick={handleSaveName}
                  disabled={saving}
                  className="p-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="font-semibold text-gray-900 truncate">
                  {profile.fullName || 'Set your name'}
                </p>
                <button
                  onClick={() => setEditingName(true)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <p className="text-sm text-gray-500 truncate">{profile.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-2 border-t border-gray-100">
          <div className="text-center">
            <p className="text-xs text-gray-400">Role</p>
            <p className="text-sm font-medium text-gray-700 capitalize">{profile.role.toLowerCase()}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400">Status</p>
            <p className="text-sm font-medium text-green-600 capitalize">{profile.status.toLowerCase()}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400">Since</p>
            <p className="text-sm font-medium text-gray-700">
              {new Date(profile.createdAt).toLocaleDateString('en-SG', { month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>
      </div>

      {/* My Progress */}
      <div className="bg-white rounded-xl p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">My Progress</h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-green-50 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-green-600">{stats.walksJoined}</p>
            <p className="text-xs text-gray-500 mt-0.5">Walks</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-blue-600">{stats.reportsSubmitted}</p>
            <p className="text-xs text-gray-500 mt-0.5">Submitted</p>
          </div>
          <div className="bg-yellow-50 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-yellow-600">{stats.draftsPending}</p>
            <p className="text-xs text-gray-500 mt-0.5">Drafts</p>
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Round Progress</span>
            <span>{stats.reportsSubmitted}/{stats.requiredWalks} walks</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Walk History */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Walk History</h2>
        {walkHistory.length === 0 ? (
          <div className="bg-white rounded-xl p-6 text-center shadow-sm">
            <p className="text-gray-500 text-sm">No walk history yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {walkHistory.map((walk) => {
              const statusLabel = walk.reportStatus === 'none' ? 'No Report'
                : walk.reportStatus === 'DRAFT' ? 'Draft'
                : 'Submitted'
              const statusColor = walk.reportStatus === 'none' ? 'text-gray-400'
                : walk.reportStatus === 'DRAFT' ? 'text-yellow-600'
                : 'text-green-600'

              return (
                <Link
                  key={walk.membershipId}
                  href={`/report/${walk.slotId}`}
                  className="block bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-900">{walk.locationName}</p>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {new Date(walk.walkDate).toLocaleDateString('en-SG', {
                          day: 'numeric', month: 'short', year: 'numeric'
                        })}
                      </p>
                      {walk.roundName && (
                        <p className="text-xs text-gray-400 mt-0.5">{walk.roundName}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className={`text-xs font-medium ${statusColor}`}>{statusLabel}</p>
                      {walk.sightingCount > 0 && (
                        <p className="text-xs text-gray-400 mt-0.5">{walk.sightingCount} sighting(s)</p>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Sign Out */}
      <button
        onClick={handleSignOut}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium transition-colors"
      >
        <LogOut className="w-4 h-4" />
        Sign Out
      </button>
    </div>
  )
}
