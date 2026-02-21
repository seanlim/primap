'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { updateSettings } from '@/lib/actions/admin-round-actions'

export function SettingsClient({ settings }: {
  settings: { requiredWalksPerRound: number; lateCancelHours: number }
}) {
  const [requiredWalks, setRequiredWalks] = useState(settings.requiredWalksPerRound.toString())
  const [lateCancelHours, setLateCancelHours] = useState(settings.lateCancelHours.toString())
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const router = useRouter()

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const result = await updateSettings({
      requiredWalksPerRound: parseInt(requiredWalks),
      lateCancelHours: parseInt(lateCancelHours),
    })
    if (result.error) alert(result.error)
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

      <form onSubmit={handleSave} className="bg-white rounded-xl p-5 shadow-sm space-y-4">
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
            Late Cancellation Window (hours)
          </label>
          <input
            type="number"
            min="1"
            max="168"
            value={lateCancelHours}
            onChange={e => setLateCancelHours(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <p className="text-xs text-gray-400 mt-1">
            Cancellations within this many hours before a walk are considered late.
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
