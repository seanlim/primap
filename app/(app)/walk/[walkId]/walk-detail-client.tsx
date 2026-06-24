'use client'

import { useRef, useState, useOptimistic, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { joinWalk, cancelWalk } from '@/lib/actions/walk-actions'
import { MapPin, Calendar, Clock, Users } from 'lucide-react'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { useToast } from '@/components/ui/toast'
import { formatDate } from '@/lib/utils/format-date'
import type { JoinBlockInfo } from '@/lib/utils/walk-participation'

interface WalkDetailProps {
  walk: {
    id: string
    locationName: string
    walkDate: string
    startTime: string
    endTime: string
    maxVolunteers: number
    notes: string | null
    roundName: string
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
  lateCancellationActive: boolean
  hasSubmittedReport: boolean
}

export function WalkDetailClient({ walk, members, isJoined, isFull, currentUserId, lateCancellationActive, hasSubmittedReport }: WalkDetailProps) {
  const [error, setError] = useState('')
  const [showCancelDialog, setShowCancelDialog] = useState(false)
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
        if (result.error) {
          setError(result.error)
          setPendingAction(null)
        } else {
          if (result.warning) {
            showToast(result.warning, 'info')
          }
          router.refresh()
        }
      })
  }

  const handleCancel = () => {
    setShowCancelDialog(true)
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
            <button
              onClick={handleJoin}
              disabled={joinDisabled}
              className="w-full bg-green-600 text-white py-3 px-4 rounded-xl hover:bg-green-700 disabled:opacity-50 font-medium transition-colors"
            >
              {isJoining ? 'Joining...' : walk.joinBlockedInfo?.label || 'Join Walk'}
            </button>
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
