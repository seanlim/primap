'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { joinSlot, cancelSlot } from '@/lib/actions/walk-actions'
import { ArrowLeft, MapPin, Calendar, Clock, Users } from 'lucide-react'
import Link from 'next/link'

interface SlotDetailProps {
  slot: {
    id: string
    locationName: string
    walkDate: string
    startTime: string
    endTime: string
    maxVolunteers: number
    notes: string | null
    roundName: string
  }
  members: {
    userId: string
    fullName: string | null
    email: string
    joinedAt: string
  }[]
  isJoined: boolean
  isFull: boolean
  currentUserId: string
}

export function SlotDetailClient({ slot, members, isJoined, isFull, currentUserId }: SlotDetailProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleJoin = async () => {
    setLoading(true)
    setError('')
    const result = await joinSlot(slot.id)
    if (result.error) {
      setError(result.error)
    } else {
      router.refresh()
    }
    setLoading(false)
  }

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel your participation?')) return
    setLoading(true)
    setError('')
    const result = await cancelSlot(slot.id)
    if (result.error) {
      setError(result.error)
    } else {
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <Link href="/walk" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" />
        Back to Walks
      </Link>

      <div className="bg-white rounded-xl p-6 shadow-sm space-y-4">
        <div>
          <p className="text-xs text-green-600 font-medium">{slot.roundName}</p>
          <h1 className="text-xl font-bold text-gray-900 mt-1">{slot.locationName}</h1>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <Calendar className="w-4 h-4 text-gray-400" />
            {new Date(slot.walkDate).toLocaleDateString('en-SG', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
            })}
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <Clock className="w-4 h-4 text-gray-400" />
            {slot.startTime.slice(0, 5)} - {slot.endTime.slice(0, 5)}
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <Users className="w-4 h-4 text-gray-400" />
            {members.length}/{slot.maxVolunteers} volunteers
          </div>
          {slot.notes && (
            <div className="flex items-start gap-3 text-sm text-gray-600">
              <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
              {slot.notes}
            </div>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">{error}</p>
        )}

        {isJoined ? (
          <div className="space-y-2">
            <div className="bg-green-50 border border-green-200 p-3 rounded-lg text-center">
              <p className="text-sm font-medium text-green-700">You&apos;re signed up for this walk</p>
            </div>
            <button
              onClick={handleCancel}
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 font-medium transition-colors disabled:opacity-50 text-sm"
            >
              {loading ? 'Cancelling...' : 'Cancel Participation'}
            </button>
          </div>
        ) : (
          <button
            onClick={handleJoin}
            disabled={loading || isFull}
            className="w-full bg-green-600 text-white py-3 px-4 rounded-xl hover:bg-green-700 disabled:opacity-50 font-medium transition-colors"
          >
            {loading ? 'Joining...' : isFull ? 'Slot Full' : 'Join Walk'}
          </button>
        )}
      </div>

      {/* Members List */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
          Group Members ({members.length})
        </h2>
        {members.length === 0 ? (
          <div className="bg-white rounded-xl p-6 text-center shadow-sm">
            <p className="text-gray-500 text-sm">No volunteers yet. Be the first to join!</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
            {members.map((member) => (
              <div key={member.userId} className="flex items-center gap-3 p-4">
                <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-medium text-green-700">
                    {(member.fullName || member.email)[0].toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {member.fullName || member.email}
                    {member.userId === currentUserId && (
                      <span className="text-green-600 ml-1">(You)</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400">
                    Joined {new Date(member.joinedAt).toLocaleDateString('en-SG')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
