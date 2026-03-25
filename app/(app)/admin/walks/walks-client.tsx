'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, Pencil, X, Layers } from 'lucide-react'
import { createWalk, updateWalk, deleteWalk, bulkCreateWalks } from '@/lib/actions/admin-round-actions'
import { formatDate, toLocalDateString } from '@/lib/utils/format-date'

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

export function WalksClient({ walks, rounds }: {
  walks: WalkData[]
  rounds: { id: string; name: string }[]
}) {
  const [showForm, setShowForm] = useState(false)
  const [showBulkForm, setShowBulkForm] = useState(false)
  const [editingWalkId, setEditingWalkId] = useState<string | null>(null)
  const [roundId, setRoundId] = useState(rounds[0]?.id || '')
  const [locationName, setLocationName] = useState('')
  const [walkDate, setWalkDate] = useState('')
  const [startTime, setStartTime] = useState('07:00')
  const [endTime, setEndTime] = useState('10:00')
  const [maxVol, setMaxVol] = useState(3)
  const [loading, setLoading] = useState(false)

  // Bulk create state
  const [bulkRoundId, setBulkRoundId] = useState(rounds[0]?.id || '')
  const [bulkRule, setBulkRule] = useState<BulkRule>({
    dateFrom: '', dateTo: '', daysOfWeek: [1, 3, 5], // Mon, Wed, Fri default
    locations: [''], startTime: '07:00', endTime: '10:00', maxVolunteers: 3,
  })
  const [generatedWalks, setGeneratedWalks] = useState<GeneratedWalk[]>([])
  const [bulkStep, setBulkStep] = useState<'rules' | 'preview'>('rules')
  const [bulkLoading, setBulkLoading] = useState(false)

  const router = useRouter()

  // When editing a walk whose round is closed (not in the active rounds list),
  // include it so the dropdown still shows the current round.
  const editingWalk = editingWalkId ? walks.find(w => w.id === editingWalkId) : null
  const effectiveRounds = editingWalk && !rounds.some(r => r.id === editingWalk.roundId)
    ? [...rounds, { id: editingWalk.roundId, name: `${editingWalk.roundName} (Closed)` }]
    : rounds

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
    if ('error' in result) alert(result.error)
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
    if ('error' in result) alert(result.error)
    else {
      cancelEdit()
      router.refresh()
    }
    setLoading(false)
  }

  const handleDelete = async (walkId: string) => {
    if (!confirm('Delete this walk?')) return
    const result = await deleteWalk(walkId)
    if ('error' in result) alert(result.error)
    else router.refresh()
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
    if (!bulkRule.dateFrom || !bulkRule.dateTo) { alert('Please select a date range'); return }
    if (bulkRule.daysOfWeek.length === 0) { alert('Please select at least one day of the week'); return }
    const validLocations = bulkRule.locations.filter(l => l.trim())
    if (validLocations.length === 0) { alert('Please enter at least one location'); return }
    const ruleWithCleanLocations = { ...bulkRule, locations: validLocations }
    const generated = generateWalksFromRules(ruleWithCleanLocations)
    if (generated.length === 0) { alert('No walks generated. Check your date range and selected days.'); return }
    setGeneratedWalks(generated)
    setBulkStep('preview')
  }

  const handleBulkConfirm = async () => {
    setBulkLoading(true)
    const result = await bulkCreateWalks({ roundId: bulkRoundId, slots: generatedWalks })
    if ('error' in result) alert(result.error)
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
    <form onSubmit={onSubmit} className="bg-white rounded-xl p-5 shadow-sm space-y-4">
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

      {showForm && walkForm(handleCreate, 'Create Walk', () => setShowForm(false))}

      {showBulkForm && (
        <div className="bg-white rounded-xl p-5 shadow-sm space-y-4">
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
                    className="w-full px-3 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">To Date</label>
                  <input type="date" value={bulkRule.dateTo}
                    onChange={e => setBulkRule(r => ({ ...r, dateTo: e.target.value }))}
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

      <div className="space-y-2">
        {walks.map(walk => (
          <div key={walk.id}>
            {editingWalkId === walk.id ? (
              walkForm(handleUpdate, 'Save Changes', cancelEdit)
            ) : (
              <div className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{walk.locationName}</p>
                  <p className="text-sm text-gray-500">
                    {formatDate(walk.walkDate, 'compact')}
                    {" "}&middot; {walk.startTime.slice(0, 5)} - {walk.endTime.slice(0, 5)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {walk.roundName} &middot; {walk.memberCount}/{walk.maxVolunteers} volunteers
                  </p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => startEdit(walk)} className="text-blue-400 hover:text-blue-600 p-2">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(walk.id)} className="text-red-400 hover:text-red-600 p-2">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
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
