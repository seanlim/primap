'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, Pencil, X, Layers, Search, ArrowRight, BarChart3 } from 'lucide-react'
import { createWalk, updateWalk, deleteWalk, bulkCreateWalks } from '@/lib/actions/admin-round-actions'
import { MAX_VOLUNTEERS_PER_SLOT } from '@/lib/constants/walks'
import { formatDate, toLocalDateString } from '@/lib/utils/format-date'
import { useToast } from '@/components/ui/toast'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'

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

function readSlotCapacity(value: number) {
  return Number.isNaN(value) ? MAX_VOLUNTEERS_PER_SLOT : value
}

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

export function WalksClient({ walks, rounds }: {
  walks: WalkData[]
  rounds: { id: string; name: string; startDate: string; endDate: string }[]
}) {
  const [showForm, setShowForm] = useState(false)
  const [showBulkForm, setShowBulkForm] = useState(false)
  const [filterDate, setFilterDate] = useState('')
  const [filterRoundName, setFilterRoundName] = useState('')
  const [filterLocation, setFilterLocation] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterRoundStatus, setFilterRoundStatus] = useState('')
  const [editingWalkId, setEditingWalkId] = useState<string | null>(null)
  const [roundId, setRoundId] = useState(rounds[0]?.id || '')
  const [locationName, setLocationName] = useState('')
  const [walkDate, setWalkDate] = useState('')
  const [startTime, setStartTime] = useState('07:00')
  const [endTime, setEndTime] = useState('10:00')
  const [maxVol, setMaxVol] = useState(MAX_VOLUNTEERS_PER_SLOT)
  const [loading, setLoading] = useState(false)

  // Bulk create state
  const [bulkRoundId, setBulkRoundId] = useState(rounds[0]?.id || '')
  const [bulkRule, setBulkRule] = useState<BulkRule>({
    dateFrom: '', dateTo: '', daysOfWeek: [1, 3, 5], // Mon, Wed, Fri default
    locations: [''], startTime: '07:00', endTime: '10:00', maxVolunteers: MAX_VOLUNTEERS_PER_SLOT,
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

  const filteredWalks = useMemo(() => {
    const normalizedRoundName = filterRoundName.trim().toLowerCase()
    const normalizedLocation = filterLocation.trim().toLowerCase()

    return walks.filter((walk) => {
      const matchesDate = !filterDate || walk.walkDate === filterDate
      const matchesRoundName =
        !normalizedRoundName || walk.roundName.toLowerCase().includes(normalizedRoundName)
      const matchesLocation =
        !normalizedLocation || walk.locationName.toLowerCase().includes(normalizedLocation)

      const walkStatus =
        walk.memberCount >= walk.maxVolunteers ? 'full' : 'open'
      const matchesStatus = !filterStatus || walkStatus === filterStatus
      const matchesRoundStatus = !filterRoundStatus || walk.roundStatus === filterRoundStatus

      return matchesDate && matchesRoundName && matchesLocation && matchesStatus && matchesRoundStatus
    })
  }, [filterDate, filterLocation, filterRoundName, filterStatus, filterRoundStatus, walks])

  const groupedWalks = useMemo(() => {
    const byRound = new Map<string, { roundId: string; roundName: string; roundStartDate: string; walks: WalkData[] }>()

    for (const walk of filteredWalks) {
      const existing = byRound.get(walk.roundId)
      if (existing) {
        existing.walks.push(walk)
        continue
      }

      byRound.set(walk.roundId, {
        roundId: walk.roundId,
        roundName: walk.roundName,
        roundStartDate: walk.roundStartDate,
        walks: [walk],
      })
    }

    return Array.from(byRound.values())
      .map((group) => ({
        ...group,
        walks: [...group.walks].sort((left, right) => {
          const leftTime = new Date(`${left.walkDate}T${left.startTime}`).getTime()
          const rightTime = new Date(`${right.walkDate}T${right.startTime}`).getTime()
          return leftTime - rightTime
        }),
      }))
      .sort((left, right) => {
        const leftTime = left.roundStartDate ? new Date(`${left.roundStartDate}T00:00:00`).getTime() : Number.MAX_SAFE_INTEGER
        const rightTime = right.roundStartDate ? new Date(`${right.roundStartDate}T00:00:00`).getTime() : Number.MAX_SAFE_INTEGER
        if (leftTime !== rightTime) return leftTime - rightTime
        return left.roundName.localeCompare(right.roundName)
      })
  }, [filteredWalks])

  const hasFilters = Boolean(filterDate || filterRoundName || filterLocation || filterStatus || filterRoundStatus)

  // When editing a walk whose round is closed (not in the active rounds list),
  // include it so the dropdown still shows the current round.
  const editingWalk = editingWalkId ? walks.find(w => w.id === editingWalkId) : null
  const effectiveRounds = editingWalk && !rounds.some(r => r.id === editingWalk.roundId)
    ? [...rounds, {
        id: editingWalk.roundId,
        name: `${editingWalk.roundName} (Closed)`,
        startDate: editingWalk.roundStartDate,
        endDate: editingWalk.roundEndDate,
      }]
    : rounds
  const selectedRound = effectiveRounds.find(r => r.id === roundId)
  const selectedBulkRound = rounds.find(r => r.id === bulkRoundId)

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
    setRoundId(walk.roundId)
    setLocationName(walk.locationName)
    setWalkDate(walk.walkDate)
    setStartTime(walk.startTime.slice(0, 5))
    setEndTime(walk.endTime.slice(0, 5))
    setMaxVol(walk.maxVolunteers)
  }

  const cancelEdit = () => {
    setEditingWalkId(null)
    setRoundId(rounds[0]?.id || '')
    setLocationName('')
    setWalkDate('')
    setStartTime('07:00')
    setEndTime('10:00')
    setMaxVol(MAX_VOLUNTEERS_PER_SLOT)
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
    if (selectedBulkRound && (bulkRule.dateFrom < selectedBulkRound.startDate || bulkRule.dateTo > selectedBulkRound.endDate)) {
      showToast(`Walk dates must be between ${selectedBulkRound.startDate} and ${selectedBulkRound.endDate}`, 'error')
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
    const result = await bulkCreateWalks({ roundId: bulkRoundId, slots: generatedWalks })
    if ('error' in result) showToast(result.error || 'An error occurred', 'error')
    else {
      setShowBulkForm(false)
      setBulkStep('rules')
      setBulkRule({ dateFrom: '', dateTo: '', daysOfWeek: [1, 3, 5], locations: [''], startTime: '07:00', endTime: '10:00', maxVolunteers: MAX_VOLUNTEERS_PER_SLOT })
      setGeneratedWalks([])
      router.refresh()
    }
    setBulkLoading(false)
  }

  const walkForm = (onSubmit: (e: React.SubmitEvent) => void, submitLabel: string, onCancel: () => void) => (
    <form onSubmit={onSubmit} className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1">Round</label>
        <select value={roundId} onChange={e => setRoundId(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500" required>
          {effectiveRounds.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>
      <input type="text" placeholder="Location name" value={locationName}
        onChange={e => setLocationName(e.target.value)}
        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" required />
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1">Date</label>
          <input type="date" value={walkDate} onChange={e => setWalkDate(e.target.value)}
            min={selectedRound?.startDate}
            max={selectedRound?.endDate}
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
        <input type="number" min="1" max={MAX_VOLUNTEERS_PER_SLOT} step="1" value={maxVol} onChange={e => setMaxVol(readSlotCapacity(e.target.valueAsNumber))}
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
          <Link href="/admin" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Walks</h1>
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

      <Link
        href="/admin/walks/analytics"
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
                value={filterRoundName}
                onChange={(e) => setFilterRoundName(e.target.value)}
                placeholder="Search round names..."
                className="w-full px-3 py-2 pl-9 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Round Status</label>
            <select
              value={filterRoundStatus}
              onChange={(e) => setFilterRoundStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">All</option>
              <option value="OPEN">Open</option>
              <option value="CLOSED">Closed</option>
              <option value="DRAFT">Draft</option>
            </select>
          </div>
        </div>
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
              setFilterDate('')
              setFilterRoundName('')
              setFilterLocation('')
              setFilterStatus('')
              setFilterRoundStatus('')
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
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Round</label>
                <select value={bulkRoundId} onChange={e => setBulkRoundId(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {rounds.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">From Date</label>
                  <input type="date" value={bulkRule.dateFrom}
                    onChange={e => setBulkRule(r => ({ ...r, dateFrom: e.target.value }))}
                    min={selectedBulkRound?.startDate}
                    max={selectedBulkRound?.endDate}
                    className="w-full px-3 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">To Date</label>
                  <input type="date" value={bulkRule.dateTo}
                    onChange={e => setBulkRule(r => ({ ...r, dateTo: e.target.value }))}
                    min={selectedBulkRound?.startDate}
                    max={selectedBulkRound?.endDate}
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
                  <input type="number" min="1" max={MAX_VOLUNTEERS_PER_SLOT} step="1" value={bulkRule.maxVolunteers}
                    onChange={e => setBulkRule(r => ({ ...r, maxVolunteers: readSlotCapacity(e.target.valueAsNumber) }))}
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
                <strong>{generatedWalks.length}</strong> walk{generatedWalks.length !== 1 ? 's' : ''} will be created in <strong>{rounds.find(r => r.id === bulkRoundId)?.name}</strong>:
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
        {groupedWalks.map((group) => (
          <section key={group.roundId} className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="border-b border-gray-100 bg-gray-50/80 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">{group.roundName}</h2>
                  <p className="mt-1 text-xs text-gray-500">
                    {group.walks.length} walk{group.walks.length === 1 ? '' : 's'} in this round
                  </p>
                </div>
                <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-500 ring-1 ring-gray-200">
                  Sorted by date
                </div>
              </div>
            </div>

            <div className="divide-y divide-gray-100">
              {group.walks.map((walk) => (
                <div key={walk.id} className="px-4 py-4">
                  {editingWalkId === walk.id ? (
                    walkForm(handleUpdate, 'Save Changes', cancelEdit)
                  ) : (
                    <div className="flex items-center justify-between gap-4 rounded-xl border border-transparent transition-colors hover:border-gray-100 hover:bg-gray-50/60">
                      <div className="min-w-0 px-1 py-1">
                        <p className="font-medium text-gray-900">{walk.locationName}</p>
                        <p className="text-sm text-gray-500">
                          {formatDate(walk.walkDate, 'compact')}
                          {' '}&middot; {walk.startTime.slice(0, 5)} - {walk.endTime.slice(0, 5)}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-400">
                          {walk.memberCount}/{walk.maxVolunteers} volunteers
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button onClick={() => startEdit(walk)} className="rounded-lg p-2 text-blue-400 hover:bg-blue-50 hover:text-blue-600">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeletingWalkId(walk.id)} className="rounded-lg p-2 text-red-400 hover:bg-red-50 hover:text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
        {walks.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center shadow-sm">
            <p className="text-gray-500">No walks yet.</p>
          </div>
        ) : groupedWalks.length === 0 ? (
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
