'use client'

import { useState, useOptimistic, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { joinWalk, cancelWalk } from '@/lib/actions/walk-actions'
import { ArrowLeft, MapPin, Calendar, Clock, Users } from 'lucide-react'
import Link from 'next/link'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'
import { useToast } from '@/components/ui/toast'
import { formatDate } from '@/lib/utils/format-date'

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
    joinBlockedReason: string | null
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
  lateCancelWarning: string | null
  hasSubmittedReport: boolean
}

export function WalkDetailClient({ walk, members, isJoined, isFull, currentUserId, lateCancelWarning, hasSubmittedReport }: WalkDetailProps) {
  const [error, setError] = useState('')
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [pendingAction, setPendingAction] = useState<'join' | 'cancel' | null>(null)
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
  const joinDisabled = isPending || optimistic.isFull || !!walk.joinBlockedReason

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
        router.refresh()
      }
    })
  }

  const handleCancel = () => {
    setShowCancelDialog(true)
  }

  const confirmCancel = () => {
    setShowCancelDialog(false)
    setError('')
    setPendingAction('cancel')
    startTransition(async () => {
      setOptimistic('cancel')
      const result = await cancelWalk(walk.id)
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

  return (
    <div className="space-y-6">
      <Link href="/walk" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" />
        Back to Walks
      </Link>

      <div className="bg-white rounded-xl p-6 shadow-sm space-y-4">
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
              {isJoining ? 'Joining...' : optimistic.isFull ? 'Walk Full' : walk.joinBlockedReason || 'Join Walk'}
            </button>
            {walk.joinBlockedReason && (
              <p className="text-xs text-gray-500 text-center">{walk.joinBlockedReason}</p>
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
          <div className="bg-white rounded-xl p-6 text-center shadow-sm">
            <p className="text-gray-500 text-sm">No volunteers yet. Be the first to join!</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
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
        message={lateCancelWarning
          ? `Are you sure you want to cancel your participation? Other group members will be notified. ${lateCancelWarning}`
          : 'Are you sure you want to cancel your participation? Other group members will be notified.'}
        confirmLabel="Yes, Cancel"
        cancelLabel="Keep"
        destructive
        onConfirm={confirmCancel}
        onCancel={() => setShowCancelDialog(false)}
      />
    </div>
  )
}
