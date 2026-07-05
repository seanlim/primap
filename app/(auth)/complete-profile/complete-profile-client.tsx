'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, CheckCircle2, Loader2, Phone, ShieldCheck, UserRound } from 'lucide-react'
import {
  saveContactDetails,
  sendAccountPhoneOtp,
  verifyAccountPhoneOtp,
} from '@/lib/actions/contact-profile-actions'
import {
  birthMonthToInput,
  formatPhoneNumberInput,
  normalizeBirthMonth,
  normalizePhoneNumber,
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
    birthMonth: string | null
  }
}

type BusyState = 'save' | 'send-account' | 'verify-account' | null

function normalizedPhoneOrNull(value: string): string | null {
  const normalized = normalizePhoneNumber(value)
  return normalized.value ?? null
}

export function CompleteProfileClient({ profile, nextPath }: Props) {
  const router = useRouter()
  const [fullName, setFullName] = useState(profile.fullName || '')
  const [phoneNumber, setPhoneNumber] = useState(formatPhoneNumberInput(profile.phoneNumber || ''))
  const [birthMonth, setBirthMonth] = useState(birthMonthToInput(profile.birthMonth))
  const [accountOtp, setAccountOtp] = useState('')
  const [verifiedAccountPhone, setVerifiedAccountPhone] = useState(
    profile.phoneVerifiedAt ? profile.phoneNumber : null
  )
  const [busy, setBusy] = useState<BusyState>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const birthMonthValidation = useMemo(() => normalizeBirthMonth(birthMonth), [birthMonth])
  const normalizedAccountPhone = normalizedPhoneOrNull(phoneNumber)
  const accountPhoneVerified = Boolean(normalizedAccountPhone && normalizedAccountPhone === verifiedAccountPhone)
  const canContinue = Boolean(birthMonthValidation.value && accountPhoneVerified)

  const contactPayload = () => ({
    fullName,
    phoneNumber,
    birthMonth,
  })

  const run = async (
    nextBusy: BusyState,
    action: () => Promise<{ success?: true; error?: string; phoneNumber?: string; alreadyVerified?: boolean }>
  ) => {
    setBusy(nextBusy)
    setError('')
    setMessage('')
    const result = await action()
    if (result.error) setError(result.error)
    setBusy(null)
    return result
  }

  const handlePhoneChange = (value: string) => {
    setPhoneNumber(formatPhoneNumberInput(value))
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
      if (result.alreadyVerified && result.phoneNumber) {
        setVerifiedAccountPhone(result.phoneNumber)
        setPhoneNumber(formatPhoneNumberInput(result.phoneNumber))
        setMessage('Account phone already verified.')
      } else {
        setVerifiedAccountPhone(null)
        setMessage('Account phone code sent.')
      }
      setAccountOtp('')
      router.refresh()
    }
  }

  const handleVerifyAccountOtp = async () => {
    const result = await run('verify-account', () => verifyAccountPhoneOtp(phoneNumber, accountOtp))
    if (result.success && result.phoneNumber) {
      setVerifiedAccountPhone(result.phoneNumber)
      setPhoneNumber(formatPhoneNumberInput(result.phoneNumber))
      setAccountOtp('')
      setMessage('Account phone verified.')
      router.refresh()
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-green-50">
              <ShieldCheck className="h-5 w-5 text-green-700" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-900">Complete your account</h1>
              <p className="mt-1 text-sm text-gray-500">{profile.email}</p>
            </div>
          </div>
        </div>

        <section className="space-y-4 rounded-lg bg-white p-5 shadow-sm">
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
              <span className="text-xs font-medium text-gray-500">Birth month</span>
              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="month"
                  value={birthMonth}
                  onChange={(event) => setBirthMonth(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-green-500"
                  required
                />
              </div>
            </label>
          </div>
        </section>

        <section className="space-y-4 rounded-lg bg-white p-5 shadow-sm">
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

          <div className="space-y-3">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-gray-500">Phone number</span>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(event) => handlePhoneChange(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500"
                placeholder="+65 9123 4567"
                required
              />
            </label>

            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
              <input
                inputMode="numeric"
                value={accountOtp}
                onChange={(event) => setAccountOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500"
                placeholder="6-digit code"
              />
              <div className="grid grid-cols-2 gap-2 md:flex">
                <button
                  type="button"
                  onClick={handleSendAccountOtp}
                  disabled={busy !== null}
                  className="inline-flex min-w-20 items-center justify-center rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                >
                  {busy === 'send-account' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send'}
                </button>
                <button
                  type="button"
                  onClick={handleVerifyAccountOtp}
                  disabled={busy !== null || accountOtp.trim().length !== 6}
                  className="inline-flex min-w-20 items-center justify-center rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {busy === 'verify-account' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
                </button>
              </div>
            </div>
          </div>
        </section>

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
            className="inline-flex items-center justify-center rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
          >
            {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save details'}
          </button>
          <button
            type="button"
            onClick={() => router.push(nextPath)}
            disabled={!canContinue || busy !== null}
            className="inline-flex items-center justify-center rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      </div>
    </main>
  )
}
