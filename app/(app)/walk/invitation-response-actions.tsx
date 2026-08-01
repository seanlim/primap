'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X } from 'lucide-react'
import { respondToSlotInvitation } from '@/lib/actions/walk-actions'
import { useToast } from '@/components/ui/toast'

interface InvitationResponseActionsProps {
  invitationId: string
  compact?: boolean
}

export function InvitationResponseActions({ invitationId, compact = false }: InvitationResponseActionsProps) {
  const [error, setError] = useState('')
  const [pendingResponse, setPendingResponse] = useState<'ACCEPTED' | 'REJECTED' | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const { showToast } = useToast()

  const respond = (response: 'ACCEPTED' | 'REJECTED') => {
    setError('')
    setPendingResponse(response)
    startTransition(async () => {
      const result = await respondToSlotInvitation(invitationId, response)
      if (result.error) {
        setError(result.error)
        setPendingResponse(null)
        return
      }

      showToast(
        response === 'ACCEPTED' ? 'Invitation accepted.' : 'Invitation declined.',
        response === 'ACCEPTED' ? 'success' : 'info'
      )
      router.refresh()
    })
  }

  const buttonBase = compact
    ? 'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50'
    : 'inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-colors disabled:opacity-50'

  return (
    <div className="space-y-2">
      <div className={compact ? 'flex flex-wrap gap-2' : 'flex gap-2'}>
        <button
          type="button"
          onClick={() => respond('ACCEPTED')}
          disabled={isPending}
          className={`${buttonBase} bg-green-600 text-white hover:bg-green-700`}
        >
          <Check className="h-4 w-4" />
          {pendingResponse === 'ACCEPTED' && isPending ? 'Accepting...' : 'Accept'}
        </button>
        <button
          type="button"
          onClick={() => respond('REJECTED')}
          disabled={isPending}
          className={`${buttonBase} border border-gray-200 text-gray-600 hover:bg-gray-50`}
        >
          <X className="h-4 w-4" />
          {pendingResponse === 'REJECTED' && isPending ? 'Declining...' : 'Decline'}
        </button>
      </div>
      {error && (
        <p className="rounded-lg bg-red-50 p-2 text-xs text-red-600">{error}</p>
      )}
    </div>
  )
}
