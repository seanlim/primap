'use client'

import { useState } from 'react'
import { CheckCircle2, CircleDashed, Loader2, Users, XCircle } from 'lucide-react'
import { saveSlotAttendance } from '@/lib/actions/attendance-actions'
import type { AttendanceStatus } from '@/lib/types/supabase-helpers'
import { useToast } from '@/components/ui/toast'

export interface AttendanceMember {
  userId: string
  fullName: string | null
  email: string
  attendance?: AttendanceStatus | null
  attendanceMarkedAt?: string | null
}

interface Props {
  slotId: string
  members: AttendanceMember[]
  canEdit: boolean
  /** Disable toggles (for example while the report form is offline). */
  disabled?: boolean
}

function memberName(member: AttendanceMember) {
  return member.fullName || member.email || 'Volunteer'
}

function formatMarkedAt(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString('en-SG', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function StatusBadge({ status }: { status: AttendanceStatus | null | undefined }) {
  if (status === 'PRESENT') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
        <CheckCircle2 className="h-3 w-3" />
        Present
      </span>
    )
  }
  if (status === 'ABSENT') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
        <XCircle className="h-3 w-3" />
        Absent
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
      <CircleDashed className="h-3 w-3" />
      Not recorded
    </span>
  )
}

/**
 * Attendance checklist for a shared walk report. Any active member of the slot
 * (or an admin) can mark who attended, and each toggle saves immediately so the
 * group can correct attendance after submitting the report.
 */
export function SlotAttendanceCard({ slotId, members, canEdit, disabled = false }: Props) {
  const [values, setValues] = useState<Record<string, AttendanceStatus>>(() =>
    Object.fromEntries(members.map(member => [member.userId, member.attendance ?? 'PRESENT']))
  )
  const [savingUserId, setSavingUserId] = useState<string | null>(null)
  const { showToast } = useToast()

  if (members.length === 0) return null

  const hasRecordedAttendance = members.some(
    member => member.attendance === 'PRESENT' || member.attendance === 'ABSENT'
  )
  const presentCount = members.filter(
    member => (values[member.userId] ?? member.attendance ?? 'PRESENT') === 'PRESENT'
  ).length

  const handleToggle = async (userId: string, next: AttendanceStatus) => {
    if (!canEdit || disabled || savingUserId) return
    const previous = values[userId] ?? 'PRESENT'
    if (previous === next) return

    setValues(current => ({ ...current, [userId]: next }))
    setSavingUserId(userId)
    const result = await saveSlotAttendance(slotId, [{ userId, status: next }])
    setSavingUserId(null)

    if (result.error) {
      setValues(current => ({ ...current, [userId]: previous }))
      showToast(result.error, 'error')
    }
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
      <div className="flex items-start gap-2">
        <Users className="mt-0.5 h-4 w-4 text-green-600" />
        <div className="flex-1">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-medium text-gray-900">Attendance</h2>
            <span className="text-xs text-gray-400">
              {presentCount}/{members.length} present
            </span>
          </div>
          {canEdit ? (
            <p className="mt-0.5 text-xs text-gray-500">
              {hasRecordedAttendance
                ? 'Tap a volunteer to correct their attendance.'
                : 'Everyone is marked present by default. Uncheck anyone who did not attend.'}
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-gray-500">
              Recorded by the volunteers who took part in this walk.
            </p>
          )}
        </div>
      </div>

      <ul className="divide-y divide-gray-100">
        {members.map(member => {
          const savedStatus = member.attendance
          const value = values[member.userId] ?? savedStatus ?? 'PRESENT'
          const isSaving = savingUserId === member.userId
          const markedAt = formatMarkedAt(member.attendanceMarkedAt)

          return (
            <li key={member.userId} className="flex items-center gap-3 py-2.5">
              {canEdit ? (
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={value === 'PRESENT'}
                  aria-label={`${memberName(member)} attended`}
                  onClick={() => handleToggle(member.userId, value === 'PRESENT' ? 'ABSENT' : 'PRESENT')}
                  disabled={disabled || savingUserId !== null}
                  className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border transition-colors ${
                    value === 'PRESENT'
                      ? 'border-green-600 bg-green-600 text-white'
                      : 'border-gray-300 bg-white text-transparent hover:border-gray-400'
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" aria-hidden="true">
                    <path
                      d="M2 6.2 4.7 9 10 3.4"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              ) : (
                <div className="w-5 flex-shrink-0" />
              )}

              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm ${canEdit ? 'font-medium' : ''} ${
                  value === 'ABSENT' && canEdit ? 'text-gray-400 line-through' : 'text-gray-900'
                }`}>
                  {memberName(member)}
                </p>
                <p className="truncate text-xs text-gray-400">
                  {member.fullName ? member.email : 'Volunteer'}
                  {markedAt ? ` · updated ${markedAt}` : ''}
                </p>
              </div>

              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              ) : (
                <StatusBadge status={canEdit ? value : savedStatus} />
              )}
            </li>
          )
        })}
      </ul>

      {canEdit && disabled && (
        <p className="text-xs text-amber-700">
          You&apos;re offline. Attendance changes will be available once you reconnect.
        </p>
      )}
    </div>
  )
}
