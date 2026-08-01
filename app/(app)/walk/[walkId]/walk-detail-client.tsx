'use client'

import { useRef, useState, useOptimistic, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  joinWalk,
  cancelWalk,
  searchInviteCandidates,
  inviteVolunteerToWalk,
  cancelSlotInvitation,
  type InviteCandidate,
} from '@/lib/actions/walk-actions'
import { MapPin, Calendar, Clock, Users, Search, UserPlus, Mail, X } from 'lucide-react'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { useToast } from '@/components/ui/toast'
import { formatDate } from '@/lib/utils/format-date'
import type { JoinBlockInfo } from '@/lib/utils/walk-participation'
import { InvitationResponseActions } from '../invitation-response-actions'

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
  pendingInvitations: {
    id: string
    invitedUserId: string
    invitedBy: string
    inviteeName: string | null
    inviteeEmail: string
    inviterName: string | null
    inviterEmail: string
    createdAt: string
  }[]
  currentUserPendingInvitation: {
    id: string
    invitedByName: string | null
    invitedByEmail: string
  } | null
  isJoined: boolean
  isFull: boolean
  reservedCount: number
  canInvite: boolean
  currentUserId: string
  lateCancelWarning: string | null
  hasSubmittedReport: boolean
}

export function WalkDetailClient({
  walk,
  members,
  pendingInvitations,
  currentUserPendingInvitation,
  isJoined,
  isFull,
  reservedCount,
  canInvite,
  currentUserId,
  lateCancelWarning,
  hasSubmittedReport,
}: WalkDetailProps) {
  const [error, setError] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [inviteQuery, setInviteQuery] = useState('')
  const [candidates, setCandidates] = useState<InviteCandidate[]>([])
  const [busyInvitationId, setBusyInvitationId] = useState<string | null>(null)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [pendingAction, setPendingAction] = useState<'join' | 'cancel' | 'searchInvitees' | 'sendInvite' | 'cancelInvite' | null>(null)
  // Synchronous in-flight gate for the cancel handler. The dialog's busy
  // prop reflects React state which lags by a render, so a fast double-
  // click could otherwise fire two cancelWalk requests before the dialog
  // disabled state propagates.
  const cancellingRef = useRef(false)
  const router = useRouter()
  const { showToast } = useToast()

  const [optimistic, setOptimistic] = useOptimistic(
    { isJoined, isFull, memberCount: members.length, reservedCount },
    (_state, action: 'join' | 'cancel') => {
      if (action === 'join') {
        const newCount = _state.memberCount + 1
        const newReservedCount = _state.reservedCount + 1
        return {
          isJoined: true,
          isFull: newReservedCount >= walk.maxVolunteers,
          memberCount: newCount,
          reservedCount: newReservedCount,
        }
      }
      const newCount = _state.memberCount - 1
      const newReservedCount = Math.max(0, _state.reservedCount - 1)
      return {
        isJoined: false,
        isFull: false,
        memberCount: newCount,
        reservedCount: newReservedCount,
      }
    }
  )

  const isJoining = isPending && pendingAction === 'join'
  const isCancelling = isPending && pendingAction === 'cancel'
  const isSearchingInvitees = isPending && pendingAction === 'searchInvitees'
  const isSendingInvite = isPending && pendingAction === 'sendInvite'
  const isCancellingInvite = isPending && pendingAction === 'cancelInvite'
  const displayIsJoined = isCancelling ? true : isJoining ? false : optimistic.isJoined
  const joinDisabled = isPending || optimistic.isFull || !!walk.joinBlockedInfo
  const pendingInvitationCount = pendingInvitations.length

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

  const handleInviteSearch = () => {
    setInviteError('')
    setPendingAction('searchInvitees')
    startTransition(async () => {
      const result = await searchInviteCandidates(walk.id, inviteQuery)
      if ('error' in result) {
        setInviteError(result.error)
      } else {
        setCandidates(result.candidates)
      }
      setPendingAction(null)
    })
  }

  const handleSendInvite = (candidate: InviteCandidate) => {
    setInviteError('')
    setBusyInvitationId(candidate.id)
    setPendingAction('sendInvite')
    startTransition(async () => {
      const result = await inviteVolunteerToWalk(walk.id, candidate.id)
      if (result.error) {
        setInviteError(result.error)
        setPendingAction(null)
        setBusyInvitationId(null)
        return
      }

      if (result.warning) {
        showToast(result.warning, 'info')
      } else {
        showToast(`Invitation sent to ${candidate.fullName || candidate.email}.`, 'success')
      }
      setInviteQuery('')
      setCandidates([])
      setBusyInvitationId(null)
      router.refresh()
    })
  }

  const handleCancelInvite = (invitationId: string) => {
    setInviteError('')
    setBusyInvitationId(invitationId)
    setPendingAction('cancelInvite')
    startTransition(async () => {
      const result = await cancelSlotInvitation(invitationId)
      if (result.error) {
        setInviteError(result.error)
        setPendingAction(null)
        setBusyInvitationId(null)
        return
      }

      showToast('Invitation cancelled.', 'info')
      setBusyInvitationId(null)
      router.refresh()
    })
  }

  const confirmCancel = () => {
    if (cancellingRef.current) return // synchronous double-submit guard
    cancellingRef.current = true
    setError('')
    setPendingAction('cancel')
    startTransition(async () => {
      setOptimistic('cancel')
      const result = await cancelWalk(walk.id)
      if (result.error) {
        setError(result.error)
        setPendingAction(null)
        setShowCancelDialog(false)
      } else {
        if (result.warning) {
          showToast(result.warning, 'info')
        }
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
            {pendingInvitationCount > 0 && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-100">
                {optimistic.reservedCount}/{walk.maxVolunteers} reserved
              </span>
            )}
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

        {currentUserPendingInvitation && !displayIsJoined ? (
          <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-amber-700 ring-1 ring-amber-100">
                <Mail className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-amber-900">Invitation pending</p>
                <p className="mt-1 text-sm text-amber-800">
                  {currentUserPendingInvitation.invitedByName || currentUserPendingInvitation.invitedByEmail || 'A volunteer'} reserved a spot for you.
                </p>
              </div>
            </div>
            <InvitationResponseActions invitationId={currentUserPendingInvitation.id} />
          </div>
        ) : displayIsJoined ? (
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

      {(displayIsJoined || pendingInvitations.length > 0) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              Invitations
            </h2>
            {pendingInvitations.length > 0 && (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-100">
                {pendingInvitations.length} pending
              </span>
            )}
          </div>

          {displayIsJoined && (
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  handleInviteSearch()
                }}
              >
                <label className="relative flex-1">
                  <span className="sr-only">Search volunteers</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    value={inviteQuery}
                    onChange={(event) => setInviteQuery(event.target.value)}
                    disabled={!canInvite || isPending}
                    placeholder={canInvite ? 'Search volunteers' : 'No reserved spots available'}
                    className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 disabled:bg-gray-50 disabled:text-gray-400"
                  />
                </label>
                <button
                  type="submit"
                  disabled={!canInvite || isPending}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                >
                  <Search className="h-4 w-4" />
                  {isSearchingInvitees ? 'Searching...' : 'Search'}
                </button>
              </form>

              {inviteError && (
                <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">{inviteError}</p>
              )}

              {candidates.length > 0 && (
                <div className="mt-4 divide-y divide-gray-100 rounded-xl border border-gray-100">
                  {candidates.map((candidate) => (
                    <div key={candidate.id} className="flex items-center gap-3 p-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sm font-medium text-sky-700">
                        {(candidate.fullName || candidate.email)[0].toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900">{candidate.fullName || candidate.email}</p>
                        {candidate.fullName && (
                          <p className="truncate text-xs text-gray-500">{candidate.email}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSendInvite(candidate)}
                        disabled={isPending}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-sky-700 disabled:opacity-50"
                      >
                        <UserPlus className="h-4 w-4" />
                        {isSendingInvite && busyInvitationId === candidate.id ? 'Inviting...' : 'Invite'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {pendingInvitations.length > 0 && (
            <div className="rounded-2xl bg-white shadow-sm divide-y divide-gray-100">
              {pendingInvitations.map((invitation) => (
                <div key={invitation.id} className="flex items-center gap-3 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-sm font-medium text-amber-700">
                    {(invitation.inviteeName || invitation.inviteeEmail)[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {invitation.inviteeName || invitation.inviteeEmail}
                      {invitation.invitedUserId === currentUserId && (
                        <span className="ml-1 text-amber-700">(You)</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400">
                      Invited by {invitation.inviterName || invitation.inviterEmail || 'a volunteer'}
                    </p>
                  </div>
                  {invitation.invitedBy === currentUserId && (
                    <button
                      type="button"
                      onClick={() => handleCancelInvite(invitation.id)}
                      disabled={isPending}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
                    >
                      <X className="h-4 w-4" />
                      {isCancellingInvite && busyInvitationId === invitation.id ? 'Cancelling...' : 'Cancel'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
        message={lateCancelWarning
          ? `Are you sure you want to cancel your participation? Other group members will be notified. ${lateCancelWarning}`
          : 'Are you sure you want to cancel your participation? Other group members will be notified.'}
        confirmLabel="Yes, Cancel"
        cancelLabel="Keep"
        destructive
        busy={isCancelling}
        onConfirm={confirmCancel}
        onCancel={() => {
          if (isCancelling) return
          setShowCancelDialog(false)
        }}
      />
    </div>
  )
}
