'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus } from 'lucide-react'
import { createRound, updateRoundStatus, deleteRound } from '@/lib/actions/admin-round-actions'

interface RoundData {
  id: string
  name: string
  description: string | null
  startDate: string
  endDate: string
  status: string
  slotCount: number
}

export function RoundsClient({ rounds }: { rounds: RoundData[] }) {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const result = await createRound({ name, description, startDate, endDate })
    if (result.error) alert(result.error)
    else {
      setShowForm(false)
      setName(''); setDescription(''); setStartDate(''); setEndDate('')
      router.refresh()
    }
    setLoading(false)
  }

  const handleStatusChange = async (roundId: string, status: 'DRAFT' | 'OPEN' | 'CLOSED') => {
    const result = await updateRoundStatus(roundId, status)
    if (result.error) alert(result.error)
    else router.refresh()
  }

  const handleDelete = async (roundId: string) => {
    if (!confirm('Delete this round and all its slots?')) return
    const result = await deleteRound(roundId)
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
          <h1 className="text-2xl font-bold text-gray-900">Survey Rounds</h1>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-green-700"
        >
          <Plus className="w-4 h-4" />
          New Round
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl p-5 shadow-sm space-y-4">
          <input
            type="text"
            placeholder="Round name"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            required
          />
          <textarea
            placeholder="Description (optional)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
            rows={2}
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">End Date</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" required />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowForm(false)}
              className="flex-1 py-3 border border-gray-300 rounded-xl text-gray-700 text-sm font-medium hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-green-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50">
              {loading ? 'Creating...' : 'Create Round'}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {rounds.map(round => (
          <div key={round.id} className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-gray-900">{round.name}</p>
                {round.description && <p className="text-sm text-gray-500 mt-0.5">{round.description}</p>}
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(round.startDate).toLocaleDateString('en-SG')} - {new Date(round.endDate).toLocaleDateString('en-SG')}
                  &middot; {round.slotCount} slot(s)
                </p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                round.status === 'OPEN' ? 'bg-green-100 text-green-700'
                : round.status === 'CLOSED' ? 'bg-gray-100 text-gray-500'
                : 'bg-yellow-100 text-yellow-700'
              }`}>
                {round.status}
              </span>
            </div>
            <div className="flex gap-2 mt-3">
              {round.status === 'DRAFT' && (
                <button onClick={() => handleStatusChange(round.id, 'OPEN')}
                  className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-200">Open</button>
              )}
              {round.status === 'OPEN' && (
                <button onClick={() => handleStatusChange(round.id, 'CLOSED')}
                  className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200">Close</button>
              )}
              {round.status === 'CLOSED' && (
                <button onClick={() => handleStatusChange(round.id, 'OPEN')}
                  className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-200">Re-open</button>
              )}
              <button onClick={() => handleDelete(round.id)}
                className="text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-200">Delete</button>
            </div>
          </div>
        ))}
        {rounds.length === 0 && (
          <div className="bg-white rounded-xl p-8 text-center shadow-sm">
            <p className="text-gray-500">No survey rounds yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}
