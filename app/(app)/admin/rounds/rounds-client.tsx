'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Pencil, Search, X, ArrowRight, BarChart3 } from 'lucide-react'
import { createRound, updateRound, updateRoundStatus, deleteRound } from '@/lib/actions/admin-round-actions'
import { formatDate } from '@/lib/utils/format-date'
import { useToast } from '@/components/ui/toast'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'

interface RoundData {
  id: string
  name: string
  description: string | null
  startDate: string
  endDate: string
  status: string
  walkCount: number
}

export function RoundsClient({ rounds }: { rounds: RoundData[] }) {
  const [showForm, setShowForm] = useState(false)
  const [searchName, setSearchName] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [editingRoundId, setEditingRoundId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editStartDate, setEditStartDate] = useState('')
  const [editEndDate, setEditEndDate] = useState('')
  const [deletingRoundId, setDeletingRoundId] = useState<string | null>(null)
  const [forceDeletingRoundId, setForceDeletingRoundId] = useState<string | null>(null)
  // Tracks an in-flight delete so the user can't double-submit by clicking
  // confirm twice (or hitting the backdrop / Escape) before the server action
  // resolves. Mirrors the actionInFlightRef pattern from `users-client.tsx`
  // (commit ec28321), originally introduced for the same class of bug.
  const deleteInFlightRef = useRef(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()
  const { showToast } = useToast()

  const filteredRounds = useMemo(() => {
    const normalizedName = searchName.trim().toLowerCase()

    return rounds
      .filter((round) => {
        const matchesName = !normalizedName || round.name.toLowerCase().includes(normalizedName)
        const matchesStatus = !filterStatus || round.status === filterStatus
        const matchesDate =
          !filterDate || (round.startDate <= filterDate && round.endDate >= filterDate)

        return matchesName && matchesStatus && matchesDate
      })
      .sort((left, right) => left.startDate.localeCompare(right.startDate))
  }, [filterDate, filterStatus, rounds, searchName])

  const hasFilters = Boolean(searchName || filterDate || filterStatus)

  const handleCreate = async (e: React.SubmitEvent) => {
    e.preventDefault()
    setLoading(true)
    const result = await createRound({ name, description, startDate, endDate })
    if (result.error) showToast(result.error, 'error')
    else {
      setShowForm(false)
      setName(''); setDescription(''); setStartDate(''); setEndDate('')
      router.refresh()
    }
    setLoading(false)
  }

  const startEdit = (round: RoundData) => {
    setEditingRoundId(round.id)
    setEditName(round.name)
    setEditDescription(round.description || '')
    setEditStartDate(round.startDate)
    setEditEndDate(round.endDate)
  }

  const cancelEdit = () => setEditingRoundId(null)

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingRoundId) return
    setLoading(true)
    const result = await updateRound(editingRoundId, {
      name: editName,
      description: editDescription,
      startDate: editStartDate,
      endDate: editEndDate,
    })
    if (result.error) showToast(result.error, 'error')
    else {
      setEditingRoundId(null)
      router.refresh()
    }
    setLoading(false)
  }

  const handleStatusChange = async (roundId: string, status: 'DRAFT' | 'OPEN' | 'CLOSED') => {
    const result = await updateRoundStatus(roundId, status)
    if (result.error) showToast(result.error, 'error')
    else router.refresh()
  }

  const confirmDeleteRound = async () => {
    if (!deletingRoundId) return
    if (deleteInFlightRef.current) return
    deleteInFlightRef.current = true
    setIsDeleting(true)

    const result = await deleteRound(deletingRoundId)
    if (result.error) {
      if (result.error.includes('submitted reports')) {
        setForceDeletingRoundId(deletingRoundId)
      }
      showToast(result.error, 'error')
    } else router.refresh()

    setDeletingRoundId(null)
    setIsDeleting(false)
    deleteInFlightRef.current = false
  }

  const confirmForceDeleteRound = async () => {
    if (!forceDeletingRoundId) return
    if (deleteInFlightRef.current) return
    deleteInFlightRef.current = true
    setIsDeleting(true)

    const result = await deleteRound(forceDeletingRoundId, { deleteSubmittedReports: true })
    if (result.error) showToast(result.error, 'error')
    else router.refresh()

    setForceDeletingRoundId(null)
    setIsDeleting(false)
    deleteInFlightRef.current = false
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Rounds</h1>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-green-700"
        >
          <Plus className="w-4 h-4" />
          New Round
        </button>
      </div>

      <Link
        href="/admin/rounds/roundAnalytics"
        className="flex items-center justify-between rounded-2xl border-l-4 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
        style={{ borderLeftColor: '#d97706' }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
            <BarChart3 className="h-5 w-5 text-amber-600" />
          </div>
          <p className="text-sm font-semibold text-gray-900">Round Analytics</p>
        </div>
        <ArrowRight className="h-4 w-4 text-gray-300" />
      </Link>

      <Link
        href="/admin/rounds/walkAnalytics"
        className="flex items-center justify-between rounded-2xl border-l-4 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
        style={{ borderLeftColor: '#d97706' }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
            <BarChart3 className="h-5 w-5 text-amber-600" />
          </div>
          <p className="text-sm font-semibold text-gray-900">Walk Analytics</p>
        </div>
        <ArrowRight className="h-4 w-4 text-gray-300" />
      </Link>

      <div className="rounded-xl bg-white p-4 shadow-sm space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Round Name</label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder="Search round names..."
                className="w-full px-3 py-2 pl-9 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Round Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">All</option>
              <option value="OPEN">Open</option>
              <option value="CLOSED">Closed</option>
              <option value="DRAFT">Draft</option>
            </select>
          </div>
        </div>
        {hasFilters && (
          <button
            onClick={() => {
              setSearchName('')
              setFilterDate('')
              setFilterStatus('')
            }}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
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
              <label className="text-xs font-medium text-gray-500 mb-1">Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" required />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1">End Date</label>
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
        {filteredRounds.map(round => (
          <div key={round.id} className="bg-white rounded-2xl p-4 shadow-sm">
            <Link href={`/admin/rounds/${round.id}/walks`}>
              {editingRoundId === round.id ? (
                <form onSubmit={handleUpdate} className="space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-gray-700">Edit Round</p>
                    <button type="button" onClick={cancelEdit} className="text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" required />
                  <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)}
                    placeholder="Description (optional)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500" rows={2} />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium text-gray-500">Start Date</label>
                      <input type="date" value={editStartDate} onChange={e => setEditStartDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" required />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">End Date</label>
                      <input type="date" value={editEndDate} onChange={e => setEditEndDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" required />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={cancelEdit}
                      className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 text-sm font-medium hover:bg-gray-50">Cancel</button>
                    <button type="submit" disabled={loading}
                      className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                      {loading ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{round.name}</p>
                      {round.description && <p className="text-sm text-gray-500 mt-0.5">{round.description}</p>}
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDate(round.startDate)} - {formatDate(round.endDate)} &middot; {round.walkCount} walk(s)
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
                    <button onClick={() => startEdit(round)}
                      className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-200 flex items-center gap-1">
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
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
                    <button onClick={() => setDeletingRoundId(round.id)}
                      className="text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-200">Delete</button>
                  </div>
                </>
              )}
            </Link>
          </div>
        ))}
        {rounds.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center shadow-sm">
            <p className="text-gray-500">No survey rounds yet.</p>
          </div>
        ) : filteredRounds.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center shadow-sm">
            <p className="text-gray-500">No rounds match those filters.</p>
          </div>
        ) : null}
      </div>

      <ConfirmationDialog
        open={!!deletingRoundId}
        title="Delete Round"
        message="Delete this round and all its walks? Draft reports, draft media, incidents, and volunteer signups will be removed. Submitted reports require a separate confirmation."
        confirmLabel="Delete"
        destructive
        busy={isDeleting}
        onConfirm={confirmDeleteRound}
        onCancel={() => {
          if (isDeleting) return
          setDeletingRoundId(null)
        }}
      />
      <ConfirmationDialog
        open={!!forceDeletingRoundId}
        title="Delete Submitted Reports?"
        message="This will permanently delete the round, its walks, submitted reports, sightings, uploaded report media, incidents, drafts, and volunteer signups."
        confirmLabel="Delete Reports"
        destructive
        busy={isDeleting}
        requiredConfirmationText="DELETE REPORTS"
        confirmationPrompt="Type DELETE REPORTS to permanently delete the round and its submitted reports."
        onConfirm={confirmForceDeleteRound}
        onCancel={() => {
          if (isDeleting) return
          setForceDeletingRoundId(null)
        }}
      />
    </div>
  )
}
