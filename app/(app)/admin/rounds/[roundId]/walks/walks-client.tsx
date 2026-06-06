'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, X, Layers, Search, ArrowRight, BarChart3, Icon, User, Users, UserMinus } from 'lucide-react'
import { createWalk, updateWalk, deleteWalk, bulkCreateWalks } from '@/lib/actions/admin-round-actions'
import { formatDate, formatTime_HH_MM, toLocalDateString } from '@/lib/utils/format-date'
import { useToast } from '@/components/ui/toast'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'
import WalkCalendar from '@/components/ui/WalkCalendar'

interface WalkData {
  id: string
  roundId: string
  roundName: string
  roundStatus: string
  roundStartDate: string
  roundEndDate: string
  locationName: string
  walkDate: string
  startTime: string
  endTime: string
  maxVolunteers: number
  volunteers: Array<{
    user_id: string,
    name: string | null,
    status: string,
    joined_at: string,
    cancelled_at: string | null,
  }>
  memberCount: number
}

interface BulkRule {
  dateFrom: string
  dateTo: string
  daysOfWeek: number[]  // 0=Sun, 1=Mon, ..., 6=Sat
  locations: string[]
  startTime: string
  endTime: string
  maxVolunteers: number
}

interface GeneratedWalk {
  locationName: string
  walkDate: string
  startTime: string
  endTime: string
  maxVolunteers: number
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function generateWalksFromRules(rule: BulkRule): GeneratedWalk[] {
  const walks: GeneratedWalk[] = []
  const start = new Date(rule.dateFrom + 'T00:00:00')
  const end = new Date(rule.dateTo + 'T00:00:00')

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (!rule.daysOfWeek.includes(d.getDay())) continue
    const dateStr = toLocalDateString(d)
    for (const loc of rule.locations) {
      walks.push({
        locationName: loc,
        walkDate: dateStr,
        startTime: rule.startTime,
        endTime: rule.endTime,
        maxVolunteers: rule.maxVolunteers,
      })
    }
  }

  return walks.sort((a, b) => a.walkDate.localeCompare(b.walkDate) || a.locationName.localeCompare(b.locationName))
}

function formatWalkTimeDisplay(walk: WalkData): string {
  return `${formatTime_HH_MM(`${walk.walkDate}T${walk.startTime}`)} - ${formatTime_HH_MM(`${walk.walkDate}T${walk.endTime}`)}`
}

export function WalksClient({ walks, round }: {
  walks: WalkData[]
  round: { id: string; name: string; startDate: string; endDate: string }
}) {
  const [showForm, setShowForm] = useState(false)
  const [showBulkForm, setShowBulkForm] = useState(false)
  const [filterLocation, setFilterLocation] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [editingWalkId, setEditingWalkId] = useState<string | null>(null)
  const [locationName, setLocationName] = useState('')
  const [walkDate, setWalkDate] = useState('')
  const [startTime, setStartTime] = useState('07:00')
  const [endTime, setEndTime] = useState('10:00')
  const [maxVol, setMaxVol] = useState(3)
  const [loading, setLoading] = useState(false)

  // Bulk create state
  const [bulkRule, setBulkRule] = useState<BulkRule>({
    dateFrom: '', dateTo: '', daysOfWeek: [1, 3, 5], // Mon, Wed, Fri default
    locations: [''], startTime: '07:00', endTime: '10:00', maxVolunteers: 3,
  })
  const [generatedWalks, setGeneratedWalks] = useState<GeneratedWalk[]>([])
  const [bulkStep, setBulkStep] = useState<'rules' | 'preview'>('rules')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [deletingWalkId, setDeletingWalkId] = useState<string | null>(null)
  const [forceDeletingWalkId, setForceDeletingWalkId] = useState<string | null>(null)
  // Tracks an in-flight delete so the user can't double-submit by clicking
  // confirm twice (or hitting the backdrop / Escape) before the server action
  // resolves. Mirrors the actionInFlightRef pattern from `users-client.tsx`
  // (commit ec28321), originally introduced for the same class of bug.
  const deleteInFlightRef = useRef(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const router = useRouter()
  const { showToast } = useToast()
  const roundId = round.id || '';

  const filteredWalks = useMemo(() => {
    const normalizedLocation = filterLocation.trim().toLowerCase()

    return walks.filter((walk) => {
      const matchesLocation =
        !normalizedLocation || walk.locationName.toLowerCase().includes(normalizedLocation)

      const walkStatus =
        walk.memberCount >= walk.maxVolunteers ? 'full' : 'open'
      const matchesStatus = !filterStatus || walkStatus === filterStatus

      return matchesLocation && matchesStatus
    })
  }, [filterLocation, filterStatus, walks])

  const sortedWalks = useMemo(() => {
    return filteredWalks.sort((left, right) => {
      const leftTime = new Date(`${left.walkDate}T${left.startTime}`).getTime()
      const rightTime = new Date(`${right.walkDate}T${right.startTime}`).getTime()
      return leftTime - rightTime
    }).sort((left, right) => {
      const leftTime = left.roundStartDate ? new Date(`${left.roundStartDate}T00:00:00`).getTime() : Number.MAX_SAFE_INTEGER
      const rightTime = right.roundStartDate ? new Date(`${right.roundStartDate}T00:00:00`).getTime() : Number.MAX_SAFE_INTEGER
      if (leftTime !== rightTime) return leftTime - rightTime
      return left.roundName.localeCompare(right.roundName)
    })
  }, [filteredWalks])

  const hasFilters = Boolean(filterLocation || filterStatus)

  const editingWalk = editingWalkId ? walks.find(w => w.id === editingWalkId) : null
  const editingWalkVolunteers = editingWalk?.volunteers.filter(v => v.status === 'ACTIVE') || []
  const editingWalkCancellations = editingWalk?.volunteers.filter(v => v.status === 'CANCELLED') || []

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
    if ('error' in result) showToast(result.error || 'An error occurred', 'error')
    else {
      setShowForm(false)
      setLocationName(''); setWalkDate('')
      router.refresh()
    }
    setLoading(false)
  }

  const startEdit = (walk: WalkData) => {
    setShowForm(false)
    setShowBulkForm(false)
    setEditingWalkId(walk.id)
    setLocationName(walk.locationName)
    setWalkDate(walk.walkDate)
    setStartTime(walk.startTime.slice(0, 5))
    setEndTime(walk.endTime.slice(0, 5))
    setMaxVol(walk.maxVolunteers)
  }

  const cancelEdit = () => {
    setEditingWalkId(null)
    setLocationName('')
    setWalkDate('')
    setStartTime('07:00')
    setEndTime('10:00')
    setMaxVol(3)
  }

  const handleUpdate = async (e: React.SubmitEvent) => {
    e.preventDefault()
    if (!editingWalkId) return
    setLoading(true)
    const result = await updateWalk(editingWalkId, {
      roundId,
      locationName,
      walkDate,
      startTime,
      endTime,
      maxVolunteers: maxVol,
    })
    if ('error' in result) showToast(result.error || 'An error occurred', 'error')
    else {
      cancelEdit()
      router.refresh()
    }
    setLoading(false)
  }

  const confirmDeleteWalk = async () => {
    if (!deletingWalkId) return
    if (deleteInFlightRef.current) return
    deleteInFlightRef.current = true
    setIsDeleting(true)

    const result = await deleteWalk(deletingWalkId)
    if ('error' in result) {
      if (result.error?.includes('submitted reports')) {
        setForceDeletingWalkId(deletingWalkId)
      }
      showToast(result.error || 'An error occurred', 'error')
    } else router.refresh()

    setDeletingWalkId(null)
    setIsDeleting(false)
    deleteInFlightRef.current = false
  }

  const confirmForceDeleteWalk = async () => {
    if (!forceDeletingWalkId) return
    if (deleteInFlightRef.current) return
    deleteInFlightRef.current = true
    setIsDeleting(true)

    const result = await deleteWalk(forceDeletingWalkId, { deleteSubmittedReports: true })
    if ('error' in result) showToast(result.error || 'An error occurred', 'error')
    else router.refresh()

    setForceDeletingWalkId(null)
    setIsDeleting(false)
    deleteInFlightRef.current = false
  }

  const toggleDay = (day: number) => {
    setBulkRule(r => ({
      ...r,
      daysOfWeek: r.daysOfWeek.includes(day)
        ? r.daysOfWeek.filter(d => d !== day)
        : [...r.daysOfWeek, day].sort(),
    }))
  }

  const updateLocation = (index: number, value: string) => {
    setBulkRule(r => ({ ...r, locations: r.locations.map((l, i) => i === index ? value : l) }))
  }

  const handleGeneratePreview = () => {
    if (!bulkRule.dateFrom || !bulkRule.dateTo) { showToast('Please select a date range', 'error'); return }
    if (round && (bulkRule.dateFrom < round.startDate || bulkRule.dateTo > round.endDate)) {
      showToast(`Walk dates must be between ${round.startDate} and ${round.endDate}`, 'error')
      return
    }
    if (bulkRule.daysOfWeek.length === 0) { showToast('Please select at least one day of the week', 'error'); return }
    const validLocations = bulkRule.locations.filter(l => l.trim())
    if (validLocations.length === 0) { showToast('Please enter at least one location', 'error'); return }
    const ruleWithCleanLocations = { ...bulkRule, locations: validLocations }
    const generated = generateWalksFromRules(ruleWithCleanLocations)
    if (generated.length === 0) { showToast('No walks generated. Check your date range and selected days.', 'error'); return }
    setGeneratedWalks(generated)
    setBulkStep('preview')
  }

  const handleBulkConfirm = async () => {
    setBulkLoading(true)
    const result = await bulkCreateWalks({ roundId: roundId, slots: generatedWalks })
    if ('error' in result) showToast(result.error || 'An error occurred', 'error')
    else {
      setShowBulkForm(false)
      setBulkStep('rules')
      setBulkRule({ dateFrom: '', dateTo: '', daysOfWeek: [1, 3, 5], locations: [''], startTime: '07:00', endTime: '10:00', maxVolunteers: 3 })
      setGeneratedWalks([])
      router.refresh()
    }
    setBulkLoading(false)
  }

  const walkForm = (onSubmit: (e: React.SubmitEvent) => void, submitLabel: string, onCancel: () => void) => (
    <form onSubmit={onSubmit} className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
      <label className="text-xs font-medium text-gray-500 mb-1">Location</label>
      <input type="text" placeholder="Location name" value={locationName}
        onChange={e => setLocationName(e.target.value)}
        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" required />
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1">Date</label>
          <input type="date" value={walkDate} onChange={e => setWalkDate(e.target.value)}
            min={round.startDate}
            max={round.endDate}
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
        <button type="button" onClick={onCancel}
          className="flex-1 py-3 border border-gray-300 rounded-xl text-gray-700 text-sm font-medium hover:bg-gray-50">
          Cancel
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 bg-green-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50">
          {loading ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/rounds" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{round.name} Walks</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowBulkForm(!showBulkForm); setShowForm(false); setEditingWalkId(null) }}
            className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700"
          >
            <Layers className="w-4 h-4" />
            Bulk Create
          </button>
          <button
            onClick={() => { setShowForm(!showForm); setShowBulkForm(false); setEditingWalkId(null) }}
            className="flex items-center gap-1 bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-green-700"
          >
            <Plus className="w-4 h-4" />
            New Walk
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Walk Location</label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
                placeholder="Search locations..."
                className="w-full px-3 py-2 pl-9 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Walk Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">All</option>
              <option value="open">Open</option>
              <option value="full">Full</option>
            </select>
          </div>
        </div>
        {hasFilters && (
          <button
            onClick={() => {
              setFilterLocation('')
              setFilterStatus('')
            }}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {showForm && walkForm(handleCreate, 'Create Walk', () => setShowForm(false))}

      {showBulkForm && (
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-900">Bulk Create Walks</h2>
          <p className="text-sm text-gray-500">Define scheduling rules and the system will generate walks automatically.</p>

          {bulkStep === 'rules' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">From Date</label>
                  <input type="date" value={bulkRule.dateFrom}
                    onChange={e => setBulkRule(r => ({ ...r, dateFrom: e.target.value }))}
                    min={round.startDate}
                    max={round.endDate}
                    className="w-full px-3 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">To Date</label>
                  <input type="date" value={bulkRule.dateTo}
                    onChange={e => setBulkRule(r => ({ ...r, dateTo: e.target.value }))}
                    min={round.startDate}
                    max={round.endDate}
                    className="w-full px-3 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 mb-2 block">Days of Week</label>
                <div className="flex gap-2">
                  {DAY_LABELS.map((label, i) => (
                    <button key={i} type="button" onClick={() => toggleDay(i)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        bulkRule.daysOfWeek.includes(i)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 mb-2 block">Locations</label>
                <div className="space-y-2">
                  {bulkRule.locations.map((loc, i) => (
                    <div key={i} className="flex gap-2">
                      <input type="text" placeholder={`Location ${i + 1}`} value={loc}
                        onChange={e => updateLocation(i, e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      {bulkRule.locations.length > 1 && (
                        <button type="button" onClick={() => setBulkRule(r => ({ ...r, locations: r.locations.filter((_, j) => j !== i) }))}
                          className="text-red-400 hover:text-red-600 p-2"><X className="w-4 h-4" /></button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={() => setBulkRule(r => ({ ...r, locations: [...r.locations, ''] }))}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                    + Add location
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Start Time</label>
                  <input type="time" value={bulkRule.startTime}
                    onChange={e => setBulkRule(r => ({ ...r, startTime: e.target.value }))}
                    className="w-full px-3 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">End Time</label>
                  <input type="time" value={bulkRule.endTime}
                    onChange={e => setBulkRule(r => ({ ...r, endTime: e.target.value }))}
                    className="w-full px-3 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Max Volunteers</label>
                  <input type="number" min="1" max="10" value={bulkRule.maxVolunteers}
                    onChange={e => setBulkRule(r => ({ ...r, maxVolunteers: e.target.valueAsNumber }))}
                    className="w-full px-3 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setShowBulkForm(false)}
                  className="flex-1 py-3 border border-gray-300 rounded-xl text-gray-700 text-sm font-medium hover:bg-gray-50">
                  Cancel
                </button>
                <button type="button" onClick={handleGeneratePreview}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-blue-700">
                  Generate Preview
                </button>
              </div>
            </>
          )}

          {bulkStep === 'preview' && (
            <>
              <p className="text-sm text-gray-600">
                <strong>{generatedWalks.length}</strong> walk{generatedWalks.length !== 1 ? 's' : ''} will be created in <strong>{round.name || ''}</strong>:
              </p>
              <div className="border border-gray-200 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">#</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Location</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Date</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Day</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Time</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Max</th>
                    </tr>
                  </thead>
                  <tbody>
                    {generatedWalks.map((walk, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                        <td className="px-3 py-2">{walk.locationName}</td>
                        <td className="px-3 py-2">{walk.walkDate}</td>
                        <td className="px-3 py-2 text-gray-500">{DAY_LABELS[new Date(walk.walkDate + 'T00:00:00').getDay()]}</td>
                        <td className="px-3 py-2">{walk.startTime} - {walk.endTime}</td>
                        <td className="px-3 py-2">{walk.maxVolunteers}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setBulkStep('rules')}
                  className="flex-1 py-3 border border-gray-300 rounded-xl text-gray-700 text-sm font-medium hover:bg-gray-50">
                  Back to Rules
                </button>
                <button type="button" onClick={handleBulkConfirm} disabled={bulkLoading}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {bulkLoading ? 'Creating...' : `Confirm & Create ${generatedWalks.length} Walk${generatedWalks.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="space-y-5">
        <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="border-b border-gray-100 bg-gray-50/80 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">{round.name}</h2>
                <p className="mt-1 text-xs text-gray-500">
                  {formatDate(round.startDate)} - {formatDate(round.endDate)} &middot; {walks.length} walk{walks.length === 1 ? '' : 's'} in this round
                </p>
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-100">
            <WalkCalendar 
              events={sortedWalks}
              initialMonth={round.startDate ? new Date(round.startDate + 'T00:00:00') : undefined}
              getEventStartTime={(walk) => `${walk.walkDate}T${walk.startTime}`}
              getEventEndTime={(walk) => `${walk.walkDate}T${walk.endTime}`}
              eventClassName={(walk) => walk.id == editingWalkId ? 'border-2 border-green-600 bg-green-50' : ''}
              renderEvent={(event) => (
                <div className='cursor-pointer'>
                    <p className="text-xxs tracking-wide">{formatWalkTimeDisplay(event)}</p>
                    <p className="text-xxs tracking-wide">{event.locationName}</p>
                    <p className="text-xxs tracking-wide">{event.memberCount}/{event.maxVolunteers} volunteers</p>
                </div>
              )}
              onEventClick={(walk) => startEdit(walk)}
            />
            {editingWalkId && (
              <div className="px-4 py-4 flex flex-col gap-3">
                {walkForm(handleUpdate, 'Save Changes', cancelEdit)}

                <div className="rounded-2xl shadow-sm">
                  <div
                    className="border-b border-gray-100 px-4 py-3 rounded-tl-2xl round3d-tr-2xl"
                    style={{ background: `linear-gradient(90deg, #bbf7d0, rgba(255,255,255,0.96))` }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center " style={{ backgroundColor: 'transparent' }}>
                        <Users className="h-5 w-5" style={{ color: '#15803d' }} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-wider text-gray-500">Volunteers</p>
                      </div>
                    </div>
                  </div>
                  
                  {editingWalkVolunteers.length === 0 ? (
                    <div className="p-4 text-center">
                      <p className="text-sm text-gray-500">No volunteers have signed up for this walk yet.</p>
                    </div>
                  ) : (
                    editingWalkVolunteers.map((membership) => (
                      <div key={membership.user_id} className="px-4 py-3 border-t border-gray-100 flex items-center gap-3">
                        {membership.name}
                      </div>
                    ))
                  )}
                </div>

                {editingWalkCancellations.length > 0 && (
                  editingWalkCancellations.map((membership) => (
                    <div className="rounded-2xl shadow-sm">
                      <div
                        className="border-b border-gray-100 px-4 py-3 rounded-tl-2xl round3d-tr-2xl"
                        style={{ background: `linear-gradient(90deg, #f7bbbb, rgba(255,255,255,0.96))` }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center " style={{ backgroundColor: 'transparent' }}>
                            <UserMinus className="h-5 w-5" style={{ color: '#801515' }} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold uppercase tracking-wider text-gray-500">Cancellations</p>
                          </div>
                        </div>
                      </div>
                      <div key={membership.user_id} className="px-4 py-3 border-t border-gray-100 flex items-center gap-3">
                        {membership.name}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </section>
        
        {walks.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center shadow-sm">
            <p className="text-gray-500">No walks yet.</p>
          </div>
        ) : walks.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center shadow-sm">
            <p className="text-gray-500">No walks match those filters.</p>
          </div>
        ) : null}
      </div>

      <ConfirmationDialog
        open={!!deletingWalkId}
        title="Delete Walk"
        message="Delete this walk? Draft reports, draft media, incidents, and volunteer signups will be removed. Submitted reports require a separate confirmation."
        confirmLabel="Delete"
        destructive
        busy={isDeleting}
        onConfirm={confirmDeleteWalk}
        onCancel={() => {
          if (isDeleting) return
          setDeletingWalkId(null)
        }}
      />
      <ConfirmationDialog
        open={!!forceDeletingWalkId}
        title="Delete Submitted Reports?"
        message="This will permanently delete the walk, submitted reports, sightings, uploaded report media, incidents, drafts, and volunteer signups."
        confirmLabel="Delete Reports"
        destructive
        busy={isDeleting}
        requiredConfirmationText="DELETE REPORTS"
        confirmationPrompt="Type DELETE REPORTS to permanently delete the walk and its submitted reports."
        onConfirm={confirmForceDeleteWalk}
        onCancel={() => {
          if (isDeleting) return
          setForceDeletingWalkId(null)
        }}
      />
    </div>
  )
}
