'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { markGuardianWorkshopAttendance, updateGuardianDetailsAsAdmin } from '@/lib/actions/guardian-actions'
import { useToast } from '@/components/ui/toast'

interface Participant {
  userId: string
  name: string
  email: string
  guardianName: string
  guardianEmail: string
  guardianPhone: string
  accompanimentAcknowledged: boolean
  workshopAttendedAt: string | null
}

export function RoundParticipantsClient({
  roundId,
  workshopRequired,
  participants,
}: {
  roundId: string
  workshopRequired: boolean
  participants: Participant[]
}) {
  const [savingUserId, setSavingUserId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Pick<Participant, 'guardianName' | 'guardianEmail' | 'guardianPhone'>>>(() =>
    Object.fromEntries(participants.map(participant => [participant.userId, {
      guardianName: participant.guardianName,
      guardianEmail: participant.guardianEmail,
      guardianPhone: participant.guardianPhone,
    }]))
  )
  const router = useRouter()
  const { showToast } = useToast()

  const saveDetails = async (participant: Participant) => {
    const details = drafts[participant.userId]
    setSavingUserId(participant.userId)
    const result = await updateGuardianDetailsAsAdmin(roundId, participant.userId, details)
    setSavingUserId(null)
    if (result.error) showToast(result.error, 'error')
    else {
      showToast('Guardian details saved.', 'success')
      router.refresh()
    }
  }

  const setWorkshopAttendance = async (participant: Participant, attended: boolean) => {
    setSavingUserId(participant.userId)
    const result = await markGuardianWorkshopAttendance(roundId, participant.userId, attended)
    setSavingUserId(null)
    if (result.error) showToast(result.error, 'error')
    else router.refresh()
  }

  if (participants.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-6 text-sm text-gray-500 shadow-sm">
        No under-18 volunteers are currently signed up for walks in this round.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {participants.map(participant => {
        const draft = drafts[participant.userId]
        const saved = draft.guardianName.trim() && draft.guardianEmail.trim()
        const busy = savingUserId === participant.userId

        return (
          <section key={participant.userId} className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
            <div>
              <h2 className="font-semibold text-gray-900">{participant.name}</h2>
              <p className="text-xs text-gray-500">{participant.email}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs font-medium text-gray-600">
                Guardian name
                <input
                  value={draft.guardianName}
                  onChange={event => setDrafts(current => ({
                    ...current,
                    [participant.userId]: { ...current[participant.userId], guardianName: event.target.value },
                  }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal text-gray-900"
                />
              </label>
              <label className="text-xs font-medium text-gray-600">
                Guardian email
                <input
                  type="email"
                  value={draft.guardianEmail}
                  onChange={event => setDrafts(current => ({
                    ...current,
                    [participant.userId]: { ...current[participant.userId], guardianEmail: event.target.value },
                  }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal text-gray-900"
                />
              </label>
              <label className="text-xs font-medium text-gray-600">
                Guardian phone (optional)
                <input
                  type="tel"
                  value={draft.guardianPhone}
                  onChange={event => setDrafts(current => ({
                    ...current,
                    [participant.userId]: { ...current[participant.userId], guardianPhone: event.target.value },
                  }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal text-gray-900"
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => saveDetails(participant)}
                className="rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {busy ? 'Saving…' : 'Save guardian details'}
              </button>
              {participant.accompanimentAcknowledged ? (
                <span className="text-xs text-green-700">Volunteer confirmed guardian accompaniment</span>
              ) : (
                <span className="text-xs text-amber-700">Volunteer confirmation still required</span>
              )}
              {workshopRequired && saved && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setWorkshopAttendance(participant, !participant.workshopAttendedAt)}
                  className={`rounded-lg px-3 py-2 text-xs font-medium disabled:opacity-50 ${
                    participant.workshopAttendedAt
                      ? 'border border-amber-300 text-amber-800 hover:bg-amber-50'
                      : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                  }`}
                >
                  {participant.workshopAttendedAt ? 'Undo workshop attendance' : 'Mark guardian attended workshop'}
                </button>
              )}
              {workshopRequired && !saved && (
                <span className="text-xs text-gray-500">Save guardian details before recording workshop attendance.</span>
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
