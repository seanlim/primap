'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LogOut, Check, Pencil, MapPin, Calendar, Footprints, ClipboardList, Eye, Phone, AlertTriangle, X } from 'lucide-react'
import { formatDate } from '@/lib/utils/format-date'
import { formatPhoneForDisplay } from '@/lib/utils/phone'
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
    phoneNumber: string | null
    phoneVerifiedAt: string | null
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
    speciesOther?: string | null
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
  const [editingContact, setEditingContact] = useState(false)
  const [name, setName] = useState(profile.fullName || '')
  const [phone, setPhone] = useState(profile.phoneNumber || '')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const router = useRouter()

  const phoneMissing = !profile.phoneNumber?.trim()

  const startEditingContact = () => {
    setName(profile.fullName || '')
    setPhone(profile.phoneNumber || '')
    setSaveError('')
    setPhoneError('')
    setEditingContact(true)
  }

  const cancelEditingContact = () => {
    setEditingContact(false)
    setSaveError('')
    setPhoneError('')
  }

  const handleSaveContact = async () => {
    setSaving(true)
    setSaveError('')
    setPhoneError('')
    const result = await updateProfile({ fullName: name, phoneNumber: phone })
    setSaving(false)
    if (result.error) {
      setSaveError(result.error)
      setPhoneError(result.fieldErrors?.phoneNumber || '')
      return
    }
    setEditingContact(false)
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
            <div className="flex items-center gap-2">
              <p className="text-lg font-bold text-white truncate">
                {profile.fullName || 'Set your name'}
              </p>
              <button
                onClick={startEditingContact}
                className="text-white/60 hover:text-white"
                aria-label="Edit contact details"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-sm text-white/70 truncate">{profile.email}</p>
            <p className="text-sm text-white/70 truncate">
              {profile.phoneNumber
                ? formatPhoneForDisplay(profile.phoneNumber)
                : 'No phone number yet'}
            </p>
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

      {phoneMissing && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-amber-800">Add a phone number to join walks</p>
            <p className="text-sm text-amber-700">
              Volunteers need a phone number so organisers can reach them in an emergency or at short notice.
            </p>
            {!editingContact && (
              <button
                onClick={startEditingContact}
                className="text-sm font-medium text-amber-800 underline underline-offset-2 hover:text-amber-900"
              >
                Add phone number
              </button>
            )}
          </div>
        </div>
      )}

      {/* Contact Details */}
      <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Contact Details</h2>
          {!editingContact && (
            <button
              onClick={startEditingContact}
              className="text-sm font-medium text-green-700 hover:text-green-800"
            >
              Edit
            </button>
          )}
        </div>

        {editingContact ? (
          <div className="space-y-3">
            <div>
              <label htmlFor="profile-name" className="mb-1 block text-sm font-medium text-gray-700">
                Full name
              </label>
              <input
                id="profile-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                autoComplete="name"
              />
            </div>
            <div>
              <label htmlFor="profile-phone" className="mb-1 block text-sm font-medium text-gray-700">
                Phone number
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="profile-phone"
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value)
                    setPhoneError('')
                    setSaveError('')
                  }}
                  placeholder="+65 9123 4567"
                  className={`w-full rounded-lg border py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 ${
                    phoneError
                      ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                      : 'border-gray-300 focus:border-green-500 focus:ring-green-100'
                  }`}
                  autoComplete="tel"
                  aria-invalid={Boolean(phoneError)}
                  aria-describedby={phoneError ? 'profile-phone-error' : 'profile-phone-help'}
                />
              </div>
              {phoneError ? (
                <p id="profile-phone-error" className="mt-1 text-xs text-red-600">{phoneError}</p>
              ) : (
                <p id="profile-phone-help" className="mt-1 text-xs text-gray-400">
                  Singapore numbers can be entered as 9123 4567. International numbers need a + prefix.
                </p>
              )}
            </div>

            {saveError && !phoneError && (
              <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{saveError}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleSaveContact}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={cancelEditingContact}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-gray-400">Name</dt>
              <dd className="mt-0.5 font-medium text-gray-900">{profile.fullName || 'Not set'}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">Phone number</dt>
              <dd className={`mt-0.5 font-medium ${phoneMissing ? 'text-amber-600' : 'text-gray-900'}`}>
                {profile.phoneNumber ? formatPhoneForDisplay(profile.phoneNumber) : 'Not set'}
                {profile.phoneVerifiedAt && (
                  <span className="ml-2 text-xs font-normal text-green-600">Verified</span>
                )}
              </dd>
            </div>
          </dl>
        )}
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
                <p className="text-[11px] text-gray-400">This round</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-blue-50 rounded-xl p-3">
              <ClipboardList className="w-4 h-4 text-blue-600 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-700">{stats.reportsSubmitted}</p>
                <p className="text-xs text-gray-500">Submitted</p>
                <p className="text-[11px] text-gray-400">This round</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-yellow-50 rounded-xl p-3">
              <Pencil className="w-4 h-4 text-yellow-600 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-yellow-700">{stats.draftsPending}</p>
                <p className="text-xs text-gray-500">Drafts</p>
                <p className="text-[11px] text-gray-400">This round</p>
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
