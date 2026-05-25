'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Cake, CheckCircle2, Loader2, Phone, ShieldCheck, UserRound } from 'lucide-react'
import {
  saveContactDetails,
  sendAccountPhoneOtp,
  sendGuardianPhoneOtp,
  verifyAccountPhoneOtp,
  verifyGuardianPhoneOtp,
} from '@/lib/actions/contact-profile-actions'
import {
  normalizeDateOfBirth,
  normalizePhoneNumber,
  requiresGuardianContact,
} from '@/lib/auth/contact-profile'

interface Props {
  nextPath: string
  profile: {
    id: string
    email: string
    fullName: string | null
    role: string
    status: string
    phoneNumber: string | null
    phoneVerifiedAt: string | null
    dateOfBirth: string | null
    guardianPhoneNumber: string | null
    guardianPhoneVerifiedAt: string | null
  }
}

type BusyState =
  | 'save'
  | 'send-account'
  | 'verify-account'
  | 'send-guardian'
  | 'verify-guardian'
  | null

function normalizedPhoneOrNull(value: string): string | null {
  const normalized = normalizePhoneNumber(value)
  return normalized.value ?? null
}

export function CompleteProfileClient({ profile, nextPath }: Props) {
  const router = useRouter()
  const [fullName, setFullName] = useState(profile.fullName || '')
  const [phoneNumber, setPhoneNumber] = useState(profile.phoneNumber || '')
  const [dateOfBirth, setDateOfBirth] = useState(profile.dateOfBirth || '')
  const [guardianPhoneNumber, setGuardianPhoneNumber] = useState(profile.guardianPhoneNumber || '')
  const [accountOtp, setAccountOtp] = useState('')
  const [guardianOtp, setGuardianOtp] = useState('')
  const [verifiedAccountPhone, setVerifiedAccountPhone] = useState(
    profile.phoneVerifiedAt ? profile.phoneNumber : null
  )
  const [verifiedGuardianPhone, setVerifiedGuardianPhone] = useState(
    profile.guardianPhoneVerifiedAt ? profile.guardianPhoneNumber : null
  )
  const [busy, setBusy] = useState<BusyState>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const dateValidation = useMemo(() => normalizeDateOfBirth(dateOfBirth), [dateOfBirth])
  const needsGuardian = dateValidation.value ? requiresGuardianContact(dateValidation.value) : false
  const normalizedAccountPhone = normalizedPhoneOrNull(phoneNumber)
  const normalizedGuardianPhone = needsGuardian ? normalizedPhoneOrNull(guardianPhoneNumber) : null
  const accountPhoneVerified = Boolean(normalizedAccountPhone && normalizedAccountPhone === verifiedAccountPhone)
  const guardianPhoneVerified = !needsGuardian || Boolean(
    normalizedGuardianPhone && normalizedGuardianPhone === verifiedGuardianPhone
  )
  const canContinue = Boolean(dateValidation.value && accountPhoneVerified && guardianPhoneVerified)

  const contactPayload = () => ({
    fullName,
    phoneNumber,
    dateOfBirth,
    guardianPhoneNumber: needsGuardian ? guardianPhoneNumber : null,
  })

  const run = async (nextBusy: BusyState, action: () => Promise<{ success?: true; error?: string; phoneNumber?: string }>) => {
    setBusy(nextBusy)
    setError('')
    setMessage('')
    const result = await action()
    if (result.error) {
      setError(result.error)
    }
    setBusy(null)
    return result
  }

  const handleSave = async () => {
    const result = await run('save', () => saveContactDetails(contactPayload()))
    if (result.success) {
      setMessage('Contact details saved.')
      router.refresh()
    }
  }

  const handleSendAccountOtp = async () => {
    const saved = await run('save', () => saveContactDetails(contactPayload()))
    if (saved.error) return

    const result = await run('send-account', () => sendAccountPhoneOtp(phoneNumber))
    if (result.success) {
      setVerifiedAccountPhone(null)
      setAccountOtp('')
      setMessage('Account phone code sent.')
      router.refresh()
    }
  }

  const handleVerifyAccountOtp = async () => {
    const result = await run('verify-account', () => verifyAccountPhoneOtp(phoneNumber, accountOtp))
    if (result.success && result.phoneNumber) {
      setVerifiedAccountPhone(result.phoneNumber)
      setAccountOtp('')
      setMessage('Account phone verified.')
      router.refresh()
    }
  }

  const handleSendGuardianOtp = async () => {
    const saved = await run('save', () => saveContactDetails(contactPayload()))
    if (saved.error) return

    const result = await run('send-guardian', () => sendGuardianPhoneOtp(guardianPhoneNumber))
    if (result.success) {
      setVerifiedGuardianPhone(null)
      setGuardianOtp('')
      setMessage('Guardian phone code sent.')
      router.refresh()
    }
  }

  const handleVerifyGuardianOtp = async () => {
    const result = await run('verify-guardian', () => verifyGuardianPhoneOtp(guardianPhoneNumber, guardianOtp))
    if (result.success && result.phoneNumber) {
      setVerifiedGuardianPhone(result.phoneNumber)
      setGuardianOtp('')
      setMessage('Guardian phone verified.')
      router.refresh()
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-green-50">
              <ShieldCheck className="h-5 w-5 text-green-700" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-900">Complete your account</h1>
              <p className="mt-1 text-sm text-gray-500">
                {profile.email}
              </p>
            </div>
          </div>
        </div>

        <section className="rounded-2xl bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <UserRound className="h-4 w-4 text-gray-500" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Profile</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-medium text-gray-500">Display name</span>
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500"
                placeholder="Name shown in Primap"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-gray-500">Date of birth</span>
              <div className="relative">
                <Cake className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(event) => setDateOfBirth(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-green-500"
                  required
                />
              </div>
            </label>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-gray-500" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Account phone</h2>
            {accountPhoneVerified && (
              <span className="ml-auto inline-flex items-center gap-1 rounded-lg bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Verified
              </span>
            )}
          </div>
          <label className="space-y-1">
            <span className="text-xs font-medium text-gray-500">Phone number</span>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500"
              placeholder="+65 9123 4567"
              required
            />
          </label>
          <div className="grid gap-2 md:grid-cols-[1fr_auto]">
            <input
              inputMode="numeric"
              value={accountOtp}
              onChange={(event) => setAccountOtp(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500"
              placeholder="6-digit code"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSendAccountOtp}
                disabled={busy !== null}
                className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
              >
                {busy === 'send-account' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send'}
              </button>
              <button
                type="button"
                onClick={handleVerifyAccountOtp}
                disabled={busy !== null || accountOtp.trim().length !== 6}
                className="rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {busy === 'verify-account' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
              </button>
            </div>
          </div>
        </section>

        {needsGuardian && (
          <section className="rounded-2xl bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-gray-500" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Guardian phone</h2>
              {guardianPhoneVerified && (
                <span className="ml-auto inline-flex items-center gap-1 rounded-lg bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Verified
                </span>
              )}
            </div>
            <label className="space-y-1">
              <span className="text-xs font-medium text-gray-500">Guardian phone number</span>
              <input
                type="tel"
                value={guardianPhoneNumber}
                onChange={(event) => setGuardianPhoneNumber(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500"
                placeholder="+65 8123 4567"
                required
              />
            </label>
            <div className="grid gap-2 md:grid-cols-[1fr_auto]">
              <input
                inputMode="numeric"
                value={guardianOtp}
                onChange={(event) => setGuardianOtp(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500"
                placeholder="6-digit code"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSendGuardianOtp}
                  disabled={busy !== null}
                  className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                >
                  {busy === 'send-guardian' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send'}
                </button>
                <button
                  type="button"
                  onClick={handleVerifyGuardianOtp}
                  disabled={busy !== null || guardianOtp.trim().length !== 6}
                  className="rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {busy === 'verify-guardian' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
                </button>
              </div>
            </div>
          </section>
        )}

        {(error || message) && (
          <p className={`rounded-lg px-3 py-2 text-sm ${error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {error || message}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={busy !== null}
            className="rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
          >
            {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save details'}
          </button>
          <button
            type="button"
            onClick={() => router.push(nextPath)}
            disabled={!canContinue || busy !== null}
            className="rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      </div>
    </main>
  )
}
