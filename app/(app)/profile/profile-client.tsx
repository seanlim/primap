'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LogOut, Check, Pencil, MapPin, Calendar, Footprints, ClipboardList, Eye } from 'lucide-react'
import { formatDate } from '@/lib/utils/format-date'
import { updateProfile } from '@/lib/actions/profile-actions'
import { signOut } from '@/lib/actions/auth-actions'
import { SightingLegend } from '@/components/admin/analytics-shared'
import { EmptyState } from '@/components/ui/empty-state'
import { MapView } from '@/components/map/map-view'
import { NOT_SIGHTED_COLOR, getSpeciesColor } from '@/lib/constants/species'

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
  reportMapPoints: {
    lat: number
    lng: number
    outcome: 'SIGHTED' | 'NOT_SIGHTED'
    species?: string
    label?: string
    popupMeta?: string[]
  }[]
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

function ProgressRing({ percent, size = 80, stroke = 6 }: { percent: number; size?: number; stroke?: number }) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percent / 100) * circumference

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="url(#progressGradient)"
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-700 ease-out"
      />
      <defs>
        <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export function ProfileClient({ profile, stats, reportMapPoints, walkHistory }: Props) {
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
    <div className="space-y-6 animate-fade-in">
      {/* Profile Header with Gradient */}
      <div className="bg-gradient-to-br from-green-600 to-emerald-500 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center flex-shrink-0 ring-4 ring-white/30">
            <span className="text-2xl font-bold text-white">
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
                  className="flex-1 px-3 py-1.5 border border-white/30 bg-white/10 backdrop-blur-sm rounded-lg text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50"
                  autoFocus
                />
                <button
                  onClick={handleSaveName}
                  disabled={saving}
                  className="p-1.5 bg-white/20 text-white rounded-lg hover:bg-white/30 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-lg font-bold text-white truncate">
                  {profile.fullName || 'Set your name'}
                </p>
                <button
                  onClick={() => setEditingName(true)}
                  className="text-white/60 hover:text-white"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <p className="text-sm text-white/70 truncate">{profile.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-white/20">
          <div className="text-center">
            <p className="text-xs text-white/60">Role</p>
            <p className="text-sm font-medium text-white capitalize">{profile.role.toLowerCase()}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-white/60">Status</p>
            <p className="text-sm font-medium text-white capitalize">{profile.status.toLowerCase()}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-white/60">Since</p>
            <p className="text-sm font-medium text-white">
              {formatDate(profile.createdAt, 'monthYear')}
            </p>
          </div>
        </div>
      </div>

      {/* Progress Section with Ring */}
      <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">My Progress</h2>

        <div className="flex items-center gap-6">
          {/* Progress Ring */}
          <div className="relative flex-shrink-0">
            <ProgressRing percent={progressPercent} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold text-gray-900">{stats.reportsSubmitted}</span>
              <span className="text-[10px] text-gray-400">of {stats.requiredWalks}</span>
            </div>
          </div>

          {/* Stat Cards */}
          <div className="flex-1 grid grid-cols-1 gap-2">
            <div className="flex items-center gap-3 bg-green-50 rounded-xl p-3">
              <Footprints className="w-4 h-4 text-green-600 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-green-700">{stats.walksJoined}</p>
                <p className="text-xs text-gray-500">Walks Joined</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-blue-50 rounded-xl p-3">
              <ClipboardList className="w-4 h-4 text-blue-600 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-700">{stats.reportsSubmitted}</p>
                <p className="text-xs text-gray-500">Submitted</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-yellow-50 rounded-xl p-3">
              <Pencil className="w-4 h-4 text-yellow-600 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-yellow-700">{stats.draftsPending}</p>
                <p className="text-xs text-gray-500">Drafts</p>
              </div>
            </div>
          </div>
        </div>

        {/* Milestone markers */}
        {progressPercent >= 100 && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3">
            <Check className="w-4 h-4 text-green-600 shrink-0" />
            <p className="text-sm font-medium text-green-700">Round requirement completed!</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
            <MapPin className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">My Sighting Map</h2>
            <p className="mt-1 text-sm text-gray-500">
              {reportMapPoints.length === 0
                ? 'No submitted report coordinates yet.'
                : `${reportMapPoints.length} report coordinate${reportMapPoints.length === 1 ? '' : 's'} plotted from your submitted reports.`}
            </p>
          </div>
        </div>

        <SightingLegend points={reportMapPoints} />

        <MapView
          className="h-80 w-full overflow-hidden rounded-2xl"
          markers={reportMapPoints.map((location, index) => ({
            ...location,
            color: location.outcome === 'SIGHTED' ? getSpeciesColor(location.species) : NOT_SIGHTED_COLOR,
            variant: location.outcome === 'SIGHTED' ? 'sighted' : 'not_sighted',
            label: location.label || `My sighting ${index + 1}`,
            popupMeta: location.popupMeta,
          }))}
        />
      </div>

      {/* Walk History Timeline */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Walk History</h2>
        {walkHistory.length === 0 ? (
          <EmptyState
            icon={Footprints}
            title="No walk history yet"
            description="Join a walk to start building your history"
            action={{ label: 'Browse Walks', href: '/walk' }}
            color="green"
          />
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-gray-200" />

            <div className="space-y-0">
              {walkHistory.map((walk) => {
                const statusColor = walk.reportStatus === 'none'
                  ? 'bg-gray-300'
                  : walk.reportStatus === 'DRAFT'
                    ? 'bg-yellow-400'
                    : 'bg-green-500'
                const statusLabel = walk.reportStatus === 'none'
                  ? 'No Report'
                  : walk.reportStatus === 'DRAFT'
                    ? 'Draft'
                    : 'Submitted'

                return (
                  <Link
                    key={walk.membershipId}
                    href={`/report/${walk.slotId}`}
                    className="flex items-start gap-4 p-3 rounded-xl hover:bg-white hover:shadow-sm transition-all group relative"
                  >
                    {/* Timeline dot */}
                    <div className={`w-2.5 h-2.5 ${statusColor} rounded-full mt-1.5 ring-4 ring-gray-50 shrink-0 relative z-10`} />

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate group-hover:text-green-700 transition-colors">{walk.locationName}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Calendar className="w-3 h-3 text-gray-400" />
                            <p className="text-xs text-gray-500">{formatDate(walk.walkDate, 'compact')}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <span className={`text-xs font-medium ${
                            walk.reportStatus === 'none' ? 'text-gray-400'
                              : walk.reportStatus === 'DRAFT' ? 'text-yellow-600'
                                : 'text-green-600'
                          }`}>{statusLabel}</span>
                          {walk.sightingCount > 0 && (
                            <div className="flex items-center gap-1 justify-end mt-0.5">
                              <Eye className="w-3 h-3 text-gray-400" />
                              <p className="text-xs text-gray-400">{walk.sightingCount}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Sign Out */}
      <button
        onClick={handleSignOut}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium transition-colors"
      >
        <LogOut className="w-4 h-4" />
        Sign Out
      </button>
    </div>
  )
}
