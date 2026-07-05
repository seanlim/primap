'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, ExternalLink, Loader2, Mail, Phone, ShieldCheck } from 'lucide-react'
import {
  saveRoundRequirements,
  sendGuardianEmailOtp,
  sendGuardianPhoneOtp,
  verifyGuardianEmailOtp,
  verifyGuardianPhoneOtp,
} from '@/lib/actions/round-requirement-actions'
import {
  formatPhoneNumberInput,
  normalizeEmailAddress,
  normalizePhoneNumber,
} from '@/lib/auth/contact-profile'

export interface RoundRequirementViewModel {
  roundId: string
  formUrl: string | null
  requiresGuardian: boolean
  complete: boolean
  missingFields: string[]
  indemnityAcknowledgedAt: string | null
  guardianName: string | null
  guardianEmail: string | null
  guardianEmailVerifiedAt: string | null
  guardianPhoneNumber: string | null
  guardianPhoneVerifiedAt: string | null
}

interface Props {
  requirement: RoundRequirementViewModel
}

type BusyState = 'save' | 'send-email' | 'verify-email' | 'send-phone' | 'verify-phone' | null

function normalizedEmailOrNull(value: string) {
  const normalized = normalizeEmailAddress(value, 'Guardian email')
  return normalized.value ?? null
}

function normalizedPhoneOrNull(value: string) {
  const normalized = normalizePhoneNumber(value, 'Guardian phone number')
  return normalized.value ?? null
}

export function RoundRequirementsPanel({ requirement }: Props) {
  const router = useRouter()
  const [indemnityAcknowledged, setIndemnityAcknowledged] = useState(Boolean(requirement.indemnityAcknowledgedAt))
  const [guardianName, setGuardianName] = useState(requirement.guardianName || '')
  const [guardianEmail, setGuardianEmail] = useState(requirement.guardianEmail || '')
  const [guardianPhoneNumber, setGuardianPhoneNumber] = useState(formatPhoneNumberInput(requirement.guardianPhoneNumber || ''))
  const [guardianEmailOtp, setGuardianEmailOtp] = useState('')
  const [guardianPhoneOtp, setGuardianPhoneOtp] = useState('')
  const [verifiedGuardianEmail, setVerifiedGuardianEmail] = useState(
    requirement.guardianEmailVerifiedAt ? requirement.guardianEmail : null
  )
  const [verifiedGuardianPhone, setVerifiedGuardianPhone] = useState(
    requirement.guardianPhoneVerifiedAt ? requirement.guardianPhoneNumber : null
  )
  const [busy, setBusy] = useState<BusyState>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const normalizedGuardianEmail = useMemo(() => normalizedEmailOrNull(guardianEmail), [guardianEmail])
  const normalizedGuardianPhone = useMemo(() => normalizedPhoneOrNull(guardianPhoneNumber), [guardianPhoneNumber])
  const guardianEmailVerified = Boolean(normalizedGuardianEmail && normalizedGuardianEmail === verifiedGuardianEmail)
  const guardianPhoneVerified = Boolean(normalizedGuardianPhone && normalizedGuardianPhone === verifiedGuardianPhone)

  const run = async (
    nextBusy: BusyState,
    action: () => Promise<{ success?: true; error?: string; guardianEmail?: string; guardianPhoneNumber?: string }>
  ) => {
    setBusy(nextBusy)
    setError('')
    setMessage('')
    const result = await action()
    if (result.error) setError(result.error)
    setBusy(null)
    return result
  }

  const inputPayload = () => ({
    indemnityAcknowledged,
    guardianName,
    guardianEmail,
    guardianPhoneNumber,
  })

  const handleSave = async () => {
    const result = await run('save', () => saveRoundRequirements(requirement.roundId, inputPayload()))
    if (result.success) {
      setMessage('Round requirements saved.')
      router.refresh()
    }
    return result
  }

  const handleSendEmailOtp = async () => {
    const saved = await run('save', () => saveRoundRequirements(requirement.roundId, inputPayload()))
    if (saved.error) return

    const result = await run('send-email', () => sendGuardianEmailOtp(requirement.roundId, guardianEmail))
    if (result.success) {
      setVerifiedGuardianEmail(null)
      setGuardianEmailOtp('')
      setMessage('Guardian email code sent.')
      router.refresh()
    }
  }

  const handleVerifyEmailOtp = async () => {
    const result = await run('verify-email', () => verifyGuardianEmailOtp(requirement.roundId, guardianEmail, guardianEmailOtp))
    if (result.success && result.guardianEmail) {
      setVerifiedGuardianEmail(result.guardianEmail)
      setGuardianEmailOtp('')
      setMessage('Guardian email verified.')
      router.refresh()
    }
  }

  const handleSendPhoneOtp = async () => {
    const saved = await run('save', () => saveRoundRequirements(requirement.roundId, inputPayload()))
    if (saved.error) return

    const result = await run('send-phone', () => sendGuardianPhoneOtp(requirement.roundId, guardianPhoneNumber))
    if (result.success) {
      setVerifiedGuardianPhone(null)
      setGuardianPhoneOtp('')
      setMessage('Guardian phone code sent.')
      router.refresh()
    }
  }

  const handleVerifyPhoneOtp = async () => {
    const result = await run('verify-phone', () => verifyGuardianPhoneOtp(requirement.roundId, guardianPhoneNumber, guardianPhoneOtp))
    if (result.success && result.guardianPhoneNumber) {
      setVerifiedGuardianPhone(result.guardianPhoneNumber)
      setGuardianPhoneNumber(formatPhoneNumberInput(result.guardianPhoneNumber))
      setGuardianPhoneOtp('')
      setMessage('Guardian phone verified.')
      router.refresh()
    }
  }

  return (
    <section className="space-y-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-yellow-700" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-yellow-800">Round requirements</h2>
        {requirement.complete && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-lg bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Complete
          </span>
        )}
      </div>

      {requirement.formUrl ? (
        <div className="space-y-3 rounded-lg bg-white p-3">
          <a
            href={requirement.formUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700 hover:text-green-800"
          >
            Open indemnity form
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={indemnityAcknowledged}
              onChange={(event) => setIndemnityAcknowledged(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
            <span>I have submitted the indemnity form for this round.</span>
          </label>
        </div>
      ) : (
        <p className="rounded-lg bg-white p-3 text-sm text-yellow-800">
          This round is missing an indemnity form link.
        </p>
      )}

      {requirement.requiresGuardian && (
        <div className="space-y-3 rounded-lg bg-white p-3">
          <label className="space-y-1">
            <span className="text-xs font-medium text-gray-500">Guardian name</span>
            <input
              value={guardianName}
              onChange={(event) => setGuardianName(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500"
            />
          </label>

          <div className="space-y-2">
            <label className="space-y-1">
              <span className="text-xs font-medium text-gray-500">Guardian email</span>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={guardianEmail}
                  onChange={(event) => setGuardianEmail(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-green-500"
                />
              </div>
            </label>
            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
              <input
                inputMode="numeric"
                value={guardianEmailOtp}
                onChange={(event) => setGuardianEmailOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500"
                placeholder="6-digit email code"
              />
              <div className="grid grid-cols-2 gap-2 md:flex">
                <button
                  type="button"
                  onClick={handleSendEmailOtp}
                  disabled={busy !== null}
                  className="inline-flex min-w-20 items-center justify-center rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                >
                  {busy === 'send-email' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send'}
                </button>
                <button
                  type="button"
                  onClick={handleVerifyEmailOtp}
                  disabled={busy !== null || guardianEmailOtp.length !== 6}
                  className="inline-flex min-w-20 items-center justify-center rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {busy === 'verify-email' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
                </button>
              </div>
            </div>
            {guardianEmailVerified && <p className="text-xs text-green-700">Guardian email verified.</p>}
          </div>

          <div className="space-y-2">
            <label className="space-y-1">
              <span className="text-xs font-medium text-gray-500">Guardian phone</span>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="tel"
                  value={guardianPhoneNumber}
                  onChange={(event) => setGuardianPhoneNumber(formatPhoneNumberInput(event.target.value))}
                  className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-green-500"
                  placeholder="+65 8123 4567"
                />
              </div>
            </label>
            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
              <input
                inputMode="numeric"
                value={guardianPhoneOtp}
                onChange={(event) => setGuardianPhoneOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500"
                placeholder="6-digit SMS code"
              />
              <div className="grid grid-cols-2 gap-2 md:flex">
                <button
                  type="button"
                  onClick={handleSendPhoneOtp}
                  disabled={busy !== null}
                  className="inline-flex min-w-20 items-center justify-center rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                >
                  {busy === 'send-phone' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send'}
                </button>
                <button
                  type="button"
                  onClick={handleVerifyPhoneOtp}
                  disabled={busy !== null || guardianPhoneOtp.length !== 6}
                  className="inline-flex min-w-20 items-center justify-center rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {busy === 'verify-phone' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
                </button>
              </div>
            </div>
            {guardianPhoneVerified && <p className="text-xs text-green-700">Guardian phone verified.</p>}
          </div>
        </div>
      )}

      {(error || message) && (
        <p className={`rounded-lg px-3 py-2 text-sm ${error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {error || message}
        </p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={busy !== null}
        className="inline-flex w-full items-center justify-center rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
      >
        {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save requirements'}
      </button>
    </section>
  )
}
