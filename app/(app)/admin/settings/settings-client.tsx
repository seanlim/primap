'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { updateSettings } from '@/lib/actions/admin-round-actions'
import { useToast } from '@/components/ui/toast'

export function SettingsClient({ settings }: {
  settings: {
    requiredWalksPerRound: number
    highParticipationThreshold: number
    maxMediaPerReport: number
    reminderSendWeekday: number
    reminderSendTime: string
    reminderWindowStartOffsetDays: number
    reminderWindowLengthDays: number
  }
}) {
  const [requiredWalks, setRequiredWalks] = useState(settings.requiredWalksPerRound.toString())
  const [highParticipationThreshold, setHighParticipationThreshold] = useState(settings.highParticipationThreshold.toString())
  const [maxMedia, setMaxMedia] = useState(settings.maxMediaPerReport.toString())
  const [reminderSendWeekday, setReminderSendWeekday] = useState(settings.reminderSendWeekday.toString())
  const initialHour = Number(settings.reminderSendTime.split(':')[0])
  const [reminderHour, setReminderHour] = useState(String(initialHour % 12 || 12))
  const [reminderPeriod, setReminderPeriod] = useState(initialHour >= 12 ? 'PM' : 'AM')
  const [reminderWindowStartOffsetDays, setReminderWindowStartOffsetDays] = useState(settings.reminderWindowStartOffsetDays.toString())
  const [reminderWindowLengthDays, setReminderWindowLengthDays] = useState(settings.reminderWindowLengthDays.toString())
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const router = useRouter()
  const { showToast } = useToast()

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const result = await updateSettings({
      requiredWalksPerRound: parseInt(requiredWalks),
      highParticipationThreshold: parseInt(highParticipationThreshold),
      maxMediaPerReport: parseInt(maxMedia),
      reminderSendWeekday: parseInt(reminderSendWeekday),
      reminderSendTime: `${String(Number(reminderHour) % 12 + (reminderPeriod === 'PM' ? 12 : 0)).padStart(2, '0')}:00`,
      reminderWindowStartOffsetDays: parseInt(reminderWindowStartOffsetDays),
      reminderWindowLengthDays: parseInt(reminderWindowLengthDays),
    })
    if (result.error) showToast(result.error, 'error')
    else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      router.refresh()
    }
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Required Walks Per Round
          </label>
          <input
            type="number"
            min="1"
            max="20"
            value={requiredWalks}
            onChange={e => setRequiredWalks(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <p className="text-xs text-gray-400 mt-1">
            Number of walks each volunteer must complete per survey round.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            High Participation Threshold
          </label>
          <input
            type="number"
            min="1"
            max="100"
            value={highParticipationThreshold}
            onChange={e => setHighParticipationThreshold(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <p className="text-xs text-gray-400 mt-1">
            Participations needed before an admin indicator appears on a volunteer.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reminder Send Day
          </label>
          <select
            value={reminderSendWeekday}
            onChange={e => setReminderSendWeekday(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="0">Sunday</option>
            <option value="1">Monday</option>
            <option value="2">Tuesday</option>
            <option value="3">Wednesday</option>
            <option value="4">Thursday</option>
            <option value="5">Friday</option>
            <option value="6">Saturday</option>
          </select>
          <p className="text-xs text-gray-400 mt-1">
            Weekly day when reminder batches are sent for upcoming walks based on Singapore time.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reminder Send Time
          </label>
          <div className="flex items-center gap-2">
            <select
              aria-label="Reminder hour"
              value={reminderHour}
              onChange={e => setReminderHour(e.target.value)}
              className="min-w-0 flex-1 px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(hour => (
                <option key={hour} value={hour}>{hour}</option>
              ))}
            </select>
            <span className="text-sm text-gray-700" aria-label="Minutes fixed at 00">:00</span>
            <select
              aria-label="AM or PM"
              value={reminderPeriod}
              onChange={e => setReminderPeriod(e.target.value)}
              className="min-w-0 flex-1 px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Time in Singapore when the reminder batch is sent for both upcoming walks and pending report submission.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reminder Window Start Offset (days)
          </label>
          <input
            type="number"
            min="0"
            max="30"
            value={reminderWindowStartOffsetDays}
            onChange={e => setReminderWindowStartOffsetDays(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <p className="text-xs text-gray-400 mt-1">
            Number of days after the reminder send date before the covered walk window begins.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reminder Window Length (days)
          </label>
          <input
            type="number"
            min="1"
            max="30"
            value={reminderWindowLengthDays}
            onChange={e => setReminderWindowLengthDays(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <p className="text-xs text-gray-400 mt-1">
            Number of walk dates covered by each reminder batch. Covered slots become late once reminded.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Max Media Files Per Report
          </label>
          <input
            type="number"
            min="1"
            max="50"
            value={maxMedia}
            onChange={e => setMaxMedia(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <p className="text-xs text-gray-400 mt-1">
            Maximum number of photos/videos allowed per sighting or observation.
          </p>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-green-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
        </button>
      </form>
    </div>
  )
}
