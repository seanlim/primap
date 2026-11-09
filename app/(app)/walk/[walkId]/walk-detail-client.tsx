'use client'

import { useRef, useState, useOptimistic, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { joinWalk, cancelWalk, getWalkLateCancellationStatus } from '@/lib/actions/walk-actions'
import { saveRoundGuardianDetails } from '@/lib/actions/guardian-actions'
import { MapPin, Calendar, Clock, Users } from 'lucide-react'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { useToast } from '@/components/ui/toast'
import { formatDate } from '@/lib/utils/format-date'
import type { JoinBlockInfo } from '@/lib/utils/walk-participation'

interface WalkDetailProps {
  walk: {
    id: string
    roundId: string
    locationName: string
    walkDate: string
    startTime: string
    endTime: string
    maxVolunteers: number
    notes: string | null
    roundName: string
    minorWorkshopRequired: boolean
    joinBlockedInfo: JoinBlockInfo | null
  }
  members: {
    userId: string
    fullName: string | null
    email: string
    joinedAt: string
  }[]
  isJoined: boolean
  isFull: boolean
  currentUserId: string
  hasSubmittedReport: boolean
  missingPhone?: boolean
  missingBirthMonth?: boolean
  isMinor?: boolean
  guardianDetails?: {
    guardianName: string
    guardianEmail: string
    guardianPhone: string
    accompanimentAcknowledged: boolean
    workshopAttended: boolean
  } | null
}

export function WalkDetailClient({
  walk,
  members,
  isJoined,
  isFull,
  currentUserId,
  hasSubmittedReport,
  missingPhone = false,
  missingBirthMonth = false,
  isMinor = false,
  guardianDetails = null,
}: WalkDetailProps) {
  const [error, setError] = useState('')
  const [guardianFormOpen, setGuardianFormOpen] = useState(
    isMinor && !guardianDetails?.accompanimentAcknowledged
  )
  const [guardianName, setGuardianName] = useState(guardianDetails?.guardianName || '')
  const [guardianEmail, setGuardianEmail] = useState(guardianDetails?.guardianEmail || '')
  const [guardianPhone, setGuardianPhone] = useState(guardianDetails?.guardianPhone || '')
  const [confirmsAccompaniment, setConfirmsAccompaniment] = useState(
    Boolean(guardianDetails?.accompanimentAcknowledged)
  )
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [lateCancellationActive, setLateCancellationActive] = useState(false)
  const [cancellationReason, setCancellationReason] = useState('')
  const [isPending, startTransition] = useTransition()
  const [pendingAction, setPendingAction] = useState<'join' | 'cancel' | null>(null)
  // Synchronous in-flight gate for the cancel handler. The dialog's busy
  // prop reflects React state which lags by a render, so a fast double-
  // click could otherwise fire two cancelWalk requests before the dialog
  // disabled state propagates.
  const cancellingRef = useRef(false)
  const router = useRouter()
  const { showToast } = useToast()

  const [optimistic, setOptimistic] = useOptimistic(
    { isJoined, isFull, memberCount: members.length },
    (_state, action: 'join' | 'cancel') => {
      if (action === 'join') {
        const newCount = _state.memberCount + 1
        return { isJoined: true, isFull: newCount >= walk.maxVolunteers, memberCount: newCount }
      }
      const newCount = _state.memberCount - 1
      return { isJoined: false, isFull: false, memberCount: newCount }
    }
  )

  const isJoining = isPending && pendingAction === 'join'
  const isCancelling = isPending && pendingAction === 'cancel'
  const displayIsJoined = isCancelling ? true : isJoining ? false : optimistic.isJoined
  const joinDisabled = isPending || optimistic.isFull || !!walk.joinBlockedInfo

  const handleJoin = () => {
    setError('')
    setPendingAction('join')
    startTransition(async () => {
      setOptimistic('join')
      const result = await joinWalk(walk.id)
      if ('error' in result) {
        setError(result.error)
        setPendingAction(null)
      } else {
        if ('warning' in result && result.warning) {
          showToast(result.warning, 'info')
        }
        router.refresh()
      }
    })
  }

  const handleSaveGuardianDetails = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setPendingAction('join')
    startTransition(async () => {
      const saved = await saveRoundGuardianDetails(walk.roundId, {
        guardianName,
        guardianEmail,
        guardianPhone,
        confirmsAccompaniment,
      })
      if (saved.error) {
        setError(saved.error)
        setPendingAction(null)
        return
      }

      if (walk.minorWorkshopRequired) {
        setPendingAction(null)
        setGuardianFormOpen(false)
        showToast('Guardian details saved. An admin must confirm workshop attendance before you can join.', 'info')
        router.refresh()
        return
      }

      const result = await joinWalk(walk.id)
      setPendingAction(null)
      if ('error' in result) {
        setError(result.error)
      } else {
        setGuardianFormOpen(false)
        router.refresh()
      }
    })
  }

  const handleCancel = () => {
    setError('')
    setPendingAction('cancel')
    startTransition(async () => {
      setOptimistic('cancel')
      const result = await getWalkLateCancellationStatus(walk.id)
      if (result.error) {
        setError(result.error)
        setPendingAction(null)
      } else {
        setLateCancellationActive(result.isLateCancellation ?? false)
        setPendingAction(null)
        setShowCancelDialog(true)
      }
    })
  }

  const confirmCancel = () => {
    if (cancellingRef.current) return // synchronous double-submit guard
    cancellingRef.current = true
    setError('')
    setPendingAction('cancel')
    startTransition(async () => {
      setOptimistic('cancel')
      const result = await cancelWalk(walk.id, lateCancellationActive ? cancellationReason : undefined)
      if (result.error) {
        setError(result.error)
        setPendingAction(null)
        setShowCancelDialog(false)
      } else {
        if (result.warning) {
          showToast(result.warning, 'info')
        }
        setCancellationReason('')
        setShowCancelDialog(false)
        router.refresh()
      }
      cancellingRef.current = false
    })
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[
        { label: 'Walks', href: '/walk' },
        { label: walk.locationName },
      ]} />

      <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
        <div>
          <p className="text-xs text-green-600 font-medium">{walk.roundName}</p>
          <h1 className="text-xl font-bold text-gray-900 mt-1">{walk.locationName}</h1>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <Calendar className="w-4 h-4 text-gray-400" />
            {formatDate(walk.walkDate, 'full')}
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <Clock className="w-4 h-4 text-gray-400" />
            {walk.startTime.slice(0, 5)} - {walk.endTime.slice(0, 5)}
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <Users className="w-4 h-4 text-gray-400" />
            {optimistic.memberCount}/{walk.maxVolunteers} volunteers
          </div>
          {walk.notes && (
            <div className="flex items-start gap-3 text-sm text-gray-600">
              <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
              {walk.notes}
            </div>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">{error}</p>
        )}

        {displayIsJoined ? (
          <div className="space-y-2">
            <div className="bg-green-50 border border-green-200 p-3 rounded-lg text-center">
              <p className="text-sm font-medium text-green-700">You&apos;re signed up for this walk</p>
            </div>
            {hasSubmittedReport ? (
              <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg text-center">
                You can&apos;t cancel this walk after submitting your report.
              </p>
            ) : (
              <button
                onClick={handleCancel}
                disabled={isPending}
                className="w-full py-3 px-4 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 font-medium transition-colors disabled:opacity-50 text-sm"
              >
                {isCancelling ? 'Cancelling...' : 'Cancel Participation'}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {missingPhone ? (
              <>
                <Link
                  href="/profile?phone=required"
                  className="block w-full bg-amber-500 text-white py-3 px-4 rounded-xl hover:bg-amber-600 font-medium transition-colors text-center"
                >
                  Add phone number to join
                </Link>
                <p className="text-xs text-amber-700 text-center">
                  A phone number is required so organisers can reach you in an emergency.
                </p>
              </>
            ) : missingBirthMonth ? (
              <>
                <Link
                  href="/profile?birth_month=required"
                  className="block w-full bg-amber-500 text-white py-3 px-4 rounded-xl hover:bg-amber-600 font-medium transition-colors text-center"
                >
                  Add birth month and year to join
                </Link>
                <p className="text-xs text-amber-700 text-center">
                  Month and year are used to determine round-specific guardian requirements.
                </p>
              </>
            ) : isMinor && guardianFormOpen ? (
              <form onSubmit={handleSaveGuardianDetails} className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div>
                  <p className="text-sm font-semibold text-amber-900">Guardian details for this round</p>
                  <p className="mt-1 text-xs text-amber-800">
                    Your guardian will receive walk reminders and must accompany you on each walk.
                  </p>
                </div>
                <label className="block text-xs font-medium text-gray-700">
                  Guardian name
                  <input
                    value={guardianName}
                    onChange={event => setGuardianName(event.target.value)}
                    required
                    autoComplete="name"
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-normal"
                  />
                </label>
                <label className="block text-xs font-medium text-gray-700">
                  Guardian email
                  <input
                    type="email"
                    value={guardianEmail}
                    onChange={event => setGuardianEmail(event.target.value)}
                    required
                    autoComplete="email"
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-normal"
                  />
                </label>
                <label className="block text-xs font-medium text-gray-700">
                  Guardian phone (optional)
                  <input
                    type="tel"
                    value={guardianPhone}
                    onChange={event => setGuardianPhone(event.target.value)}
                    autoComplete="tel"
                    placeholder="+65 9123 4567"
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-normal"
                  />
                </label>
                <label className="flex items-start gap-2 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={confirmsAccompaniment}
                    onChange={event => setConfirmsAccompaniment(event.target.checked)}
                    required
                    className="mt-0.5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <span>I confirm these details are correct and this guardian will accompany me on every walk in this round.</span>
                </label>
                {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="flex-1 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    {isJoining ? 'Saving…' : 'Save and join walk'}
                  </button>
                  {guardianDetails?.accompanimentAcknowledged && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => setGuardianFormOpen(false)}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            ) : isMinor && walk.minorWorkshopRequired && !guardianDetails?.workshopAttended ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
                <p className="text-sm font-medium text-amber-900">Admin confirmation required</p>
                <p className="mt-1 text-xs text-amber-800">Your guardian must attend the round workshop. An admin will confirm attendance before you can join a walk.</p>
                {guardianDetails?.accompanimentAcknowledged && (
                  <button
                    type="button"
                    onClick={() => setGuardianFormOpen(true)}
                    className="mt-2 text-xs font-medium text-amber-900 underline"
                  >
                    Update guardian details
                  </button>
                )}
              </div>
            ) : isMinor && !guardianDetails?.accompanimentAcknowledged ? (
              <button
                type="button"
                onClick={() => setGuardianFormOpen(true)}
                className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-medium text-white hover:bg-amber-600"
              >
                Add guardian details to join
              </button>
            ) : (
              <button
                onClick={handleJoin}
                disabled={joinDisabled}
                className="w-full bg-green-600 text-white py-3 px-4 rounded-xl hover:bg-green-700 disabled:opacity-50 font-medium transition-colors"
              >
                {isJoining ? 'Joining...' : walk.joinBlockedInfo?.label || 'Join Walk'}
              </button>
            )}
            {isMinor && guardianDetails?.accompanimentAcknowledged && !guardianFormOpen && !walk.minorWorkshopRequired && (
              <button
                type="button"
                onClick={() => setGuardianFormOpen(true)}
                className="block w-full text-center text-xs font-medium text-gray-500 underline"
              >
                Update guardian details
              </button>
            )}
            {walk.joinBlockedInfo && (
              <p className="text-xs text-gray-500 text-center">{walk.joinBlockedInfo.description}</p>
            )}
          </div>
        )}
      </div>

      {/* Members List */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
          Group Members ({members.length})
        </h2>
        {members.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
            <div className="w-14 h-14 bg-green-50 ring-4 ring-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-7 h-7 text-green-500" />
            </div>
            <p className="font-medium text-gray-700">No volunteers yet</p>
            <p className="text-sm text-gray-400 mt-1">Be the first to join!</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-100">
            {members.map((member) => (
              <div key={member.userId} className="flex items-center gap-3 p-4">
                <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-medium text-green-700">
                    {(member.fullName || member.email)[0].toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {member.fullName || member.email}
                    {member.userId === currentUserId && (
                      <span className="text-green-600 ml-1">(You)</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400">
                    Joined {formatDate(member.joinedAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmationDialog
        open={showCancelDialog}
        title="Cancel Participation"
        message={lateCancellationActive
          ? 'Are you sure you want to cancel your participation? Other group members will be notified. This walk is already in the late cancellation period because participant reminders were sent.'
          : 'Are you sure you want to cancel your participation? Other group members will be notified.'}
        confirmLabel="Yes, Cancel"
        cancelLabel="Keep"
        textareaLabel={lateCancellationActive ? 'Reason for late cancellation' : undefined}
        textareaPlaceholder={lateCancellationActive ? 'Share the reason for this late cancellation' : undefined}
        textareaValue={cancellationReason}
        textareaRequired={lateCancellationActive}
        textareaMaxLength={1000}
        onTextareaChange={setCancellationReason}
        destructive
        busy={isCancelling}
        onConfirm={confirmCancel}
        onCancel={() => {
          if (isCancelling) return
          setCancellationReason('')
          setShowCancelDialog(false)
        }}
      />
    </div>
  )
}
