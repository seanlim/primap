'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { createWalk, deleteWalk } from '@/lib/actions/admin-round-actions'
import { formatDate } from '@/lib/utils/format-date'

interface WalkData {
  id: string
  roundId: string
  roundName: string
  locationName: string
  walkDate: string
  startTime: string
  endTime: string
  maxVolunteers: number
  memberCount: number
}

export function WalksClient({ walks, rounds }: {
  walks: WalkData[]
  rounds: { id: string; name: string }[]
}) {
  const [showForm, setShowForm] = useState(false)
  const [roundId, setRoundId] = useState(rounds[0]?.id || '')
  const [locationName, setLocationName] = useState('')
  const [walkDate, setWalkDate] = useState('')
  const [startTime, setStartTime] = useState('07:00')
  const [endTime, setEndTime] = useState('10:00')
  const [maxVol, setMaxVol] = useState(3)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleCreate = async (e: React.SubmitEvent) => {
    e.preventDefault()
    setLoading(true)
    const result = await createWalk({
      roundId,
      locationName,
      walkDate,
      startTime,
      endTime,
      maxVolunteers: maxVol,
    })
    if (result.error) alert(result.error)
    else {
      setShowForm(false)
      setLocationName(''); setWalkDate('')
      router.refresh()
    }
    setLoading(false)
  }

  const handleDelete = async (walkId: string) => {
    if (!confirm('Delete this walk?')) return
    const result = await deleteWalk(walkId)
    if (result.error) alert(result.error)
    else router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Walks</h1>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-green-700"
        >
          <Plus className="w-4 h-4" />
          New Walk
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl p-5 shadow-sm space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1">Round</label>
            <select value={roundId} onChange={e => setRoundId(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500" required>
              {rounds.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <input type="text" placeholder="Location name" value={locationName}
            onChange={e => setLocationName(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" required />
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1">Date</label>
              <input type="date" value={walkDate} onChange={e => setWalkDate(e.target.value)}
                className="w-full px-3 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" required />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1">Start</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                className="w-full px-3 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" required />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1">End</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                className="w-full px-3 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" required />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1">Max Volunteers</label>
            <input type="number" min="1" max="10" value={maxVol} onChange={e => setMaxVol(e.target.valueAsNumber)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowForm(false)}
              className="flex-1 py-3 border border-gray-300 rounded-xl text-gray-700 text-sm font-medium hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-green-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50">
              {loading ? 'Creating...' : 'Create Walk'}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {walks.map(walk => (
          <div key={walk.id} className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">{walk.locationName}</p>
              <p className="text-sm text-gray-500">
                {formatDate(walk.walkDate, 'compact')}
                {" "} &middot; {walk.startTime.slice(0, 5)} - {walk.endTime.slice(0, 5)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {walk.roundName} &middot; {walk.memberCount}/{walk.maxVolunteers} volunteers
              </p>
            </div>
            <button onClick={() => handleDelete(walk.id)} className="text-red-400 hover:text-red-600 p-2">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {walks.length === 0 && (
          <div className="bg-white rounded-xl p-8 text-center shadow-sm">
            <p className="text-gray-500">No walks yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}
