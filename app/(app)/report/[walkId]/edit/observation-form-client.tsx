'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, Loader2 } from 'lucide-react'
import { formatDate, toLocalDateString } from '@/lib/utils/format-date'
import { saveDraft, submitObservation } from '@/lib/actions/observation-actions'
import { LocationPicker } from '@/components/map/location-picker'
import { MediaUploader, type MediaItem } from '@/components/report/media-uploader'

interface SightingForm {
  id?: string
  species: 'RBL' | 'LTM' | 'DUSKY' | ''
  count: string
  observedAt: string
  lat: number | null
  lng: number | null
  notes: string
  media: MediaItem[]
}

interface Props {
  slot: {
    id: string
    locationName: string
    walkDate: string
    startTime: string
    endTime: string
    roundName: string
  }
  existingObservation: {
    id: string
    walkCompletion: 'COMPLETED' | 'PARTIAL' | 'ABORTED' | null
    outcome: 'SIGHTED' | 'NOT_SIGHTED' | null
    notes: string | null
    lat: number | null
    lng: number | null
    sightings: {
      id: string
      species: 'RBL' | 'LTM' | 'DUSKY'
      count: string
      observedAt: string | null
      lat: number
      lng: number
      notes: string | null
      media: MediaItem[]
    }[]
    media: MediaItem[]
  } | null
}

const WALK_COMPLETION_OPTIONS = [
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'PARTIAL', label: 'Partial' },
  { value: 'ABORTED', label: 'Aborted' },
]

const SPECIES_OPTIONS = [
  { value: 'RBL', label: "Raffles' Banded Langur" },
  { value: 'LTM', label: 'Long-tailed Macaque' },
  { value: 'DUSKY', label: 'Dusky Langur' },
]

export function ObservationFormClient({ slot, existingObservation }: Props) {
  const [walkCompletion, setWalkCompletion] = useState<string>(existingObservation?.walkCompletion || '')
  const [notes, setNotes] = useState(existingObservation?.notes || '')
  const [lat, setLat] = useState<number | null>(existingObservation?.lat ?? null)
  const [lng, setLng] = useState<number | null>(existingObservation?.lng ?? null)
  const [observationId, setObservationId] = useState<string | undefined>(existingObservation?.id)
  const [sightings, setSightings] = useState<SightingForm[]>(
    existingObservation?.sightings.map(s => ({
      id: s.id,
      species: s.species,
      count: s.count,
      observedAt: s.observedAt || '',
      lat: s.lat,
      lng: s.lng,
      notes: s.notes || '',
      media: s.media || [],
    })) || []
  )
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [savedMessage, setSavedMessage] = useState('')
  const router = useRouter()

  const addSighting = () => {
    const now = new Date()
    // Format as datetime-local value: YYYY-MM-DDTHH:MM
    const hh = String(now.getHours()).padStart(2, '0')
    const min = String(now.getMinutes()).padStart(2, '0')
    const currentTime = `${toLocalDateString(now)}T${hh}:${min}`

    setSightings(prev => [...prev, {
      species: '',
      count: '1',
      observedAt: currentTime,
      lat: null,
      lng: null,
      notes: '',
      media: [],
    }])
  }

  const removeSighting = (index: number) => {
    setSightings(prev => prev.filter((_, i) => i !== index))
  }

  const [autoSaveCounter, setAutoSaveCounter] = useState(0)
  const [autoSavingIndexes, setAutoSavingIndexes] = useState<Set<number>>(new Set())

  const updateSighting = (index: number, field: keyof SightingForm, value: string | number | null) => {
    setSightings(prev => {
      const updated = prev.map((s, i) => i === index ? { ...s, [field]: value } : s)
      // Auto-save when species is selected on a new sighting (no id yet) so it gets a DB id for media uploads
      if (field === 'species' && value && !prev[index].id) {
        setAutoSavingIndexes(prev => new Set(prev).add(index))
        setAutoSaveCounter(c => c + 1)
      }
      return updated
    })
  }

  // Run auto-save when triggered
  const autoSaveRef = useRef(0)
  useEffect(() => {
    if (autoSaveCounter > 0 && autoSaveCounter !== autoSaveRef.current) {
      autoSaveRef.current = autoSaveCounter
      handleSaveDraft(true).then(() => setAutoSavingIndexes(new Set()))
    }
  }, [autoSaveCounter]) // eslint-disable-line react-hooks/exhaustive-deps

  const buildSightingsPayload = (fromSightings?: SightingForm[]) => {
    return (fromSightings ?? sightings).filter(s => s.species).map(s => ({
      id: s.id,
      species: s.species as 'RBL' | 'LTM' | 'DUSKY',
      count: s.count || '1',
      observed_at: s.observedAt || undefined,
      lat: s.lat || 0,
      lng: s.lng || 0,
      notes: s.notes || undefined,
    }))
  }

  const handleSaveDraft = async (silent = false) => {
    setSaving(true)
    if (!silent) {
      setError('')
      setSavedMessage('')
    }

    const validSightings = buildSightingsPayload()
    const hasSightings = validSightings.length > 0

    const result = await saveDraft({
      walkId: slot.id,
      observationId,
      walkCompletion: walkCompletion as 'COMPLETED' | 'PARTIAL' | 'ABORTED' | undefined,
      outcome: hasSightings ? 'SIGHTED' : undefined,
      notes: notes || undefined,
      lat: lat ?? undefined,
      lng: lng ?? undefined,
      sightings: validSightings,
    })

    if (result.error) {
      if (!silent) setError(result.error)
    } else {
      // Update local state with server-assigned IDs
      if (result.observationId) setObservationId(result.observationId)
      if (result.sightingIds && result.sightingIds.length > 0) {
        setSightings(prev => {
          const validIndexes: number[] = []
          prev.forEach((s, i) => { if (s.species) validIndexes.push(i) })
          return prev.map((s, i) => {
            const validIdx = validIndexes.indexOf(i)
            if (validIdx >= 0 && validIdx < result.sightingIds!.length) {
              return { ...s, id: result.sightingIds![validIdx] }
            }
            return s
          })
        })
      }
      if (!silent) {
        setSavedMessage('Draft saved')
        setTimeout(() => setSavedMessage(''), 2000)
      }
    }
    setSaving(false)
  }

  const handleSubmit = async () => {
    const validSightings = buildSightingsPayload()
    const hasSightings = validSightings.length > 0

    if (!hasSightings) {
      if (!confirm("You haven't added any sightings. Submit as Not Sighted?")) return
    }

    if (!confirm('Submit this report? You won\'t be able to edit it after submission.')) return

    setSaving(true)
    setSubmitting(true)
    setError('')

    const outcome = hasSightings ? 'SIGHTED' : 'NOT_SIGHTED'

    const saveResult = await saveDraft({
      walkId: slot.id,
      observationId,
      walkCompletion: walkCompletion as 'COMPLETED' | 'PARTIAL' | 'ABORTED' | undefined,
      outcome,
      notes: notes || undefined,
      lat: lat ?? undefined,
      lng: lng ?? undefined,
      sightings: validSightings,
    })

    if (saveResult.error) {
      setError(saveResult.error)
      setSaving(false)
      setSubmitting(false)
      return
    }

    const obsId = saveResult.observationId || observationId
    if (!obsId) {
      setError('Failed to save observation')
      setSaving(false)
      setSubmitting(false)
      return
    }

    const submitResult = await submitObservation(obsId, slot.id)
    if (submitResult.error) {
      setError(submitResult.error)
    } else {
      router.push(`/report/${slot.id}`)
    }
    setSaving(false)
    setSubmitting(false)
  }

  const hasSightings = sightings.some(s => s.species)

  return (
    <div className="space-y-6">
      <Link href={`/report/${slot.id}`} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" />
        Back to Group View
      </Link>

      <div>
        <h1 className="text-xl font-bold text-gray-900">Edit Report</h1>
        <p className="text-sm text-gray-500 mt-1">
          {slot.locationName} &middot; {formatDate(slot.walkDate, 'compact')}
        </p>
      </div>

      {/* Step 1: Walk Completion */}
      <div className="bg-white rounded-xl p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">1. Walk Completion</h2>
        <div className="grid grid-cols-3 gap-2">
          {WALK_COMPLETION_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setWalkCompletion(opt.value)}
              className={`py-2.5 px-3 rounded-xl text-sm font-medium transition-colors ${
                walkCompletion === opt.value
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Step 2: Sightings */}
      <div className="bg-white rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">2. Sightings</h2>
          <button
            type="button"
            onClick={addSighting}
            className="flex items-center gap-1 text-sm text-green-600 font-medium hover:text-green-700"
          >
            <Plus className="w-4 h-4" />
            Add Sighting
          </button>
        </div>

        {sightings.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">
            No sightings yet. Add sightings or submit as &quot;Not Sighted&quot;.
          </p>
        )}

        {sightings.map((sighting, index) => (
          <div key={sighting.id || index} className="border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Sighting #{index + 1}</span>
              <button
                type="button"
                onClick={() => removeSighting(index)}
                className="text-red-400 hover:text-red-600"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Species *</label>
              <select
                value={sighting.species}
                onChange={(e) => updateSighting(index, 'species', e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">Select species...</option>
                {SPECIES_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            {sighting.species && autoSavingIndexes.has(index) && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
              </div>
            )}

            {sighting.species && !autoSavingIndexes.has(index) && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Count *</label>
                    <input
                      type="text"
                      value={sighting.count}
                      onChange={(e) => updateSighting(index, 'count', e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="e.g. 3, 5-8, Unknown"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Time</label>
                    <input
                      type="datetime-local"
                      value={sighting.observedAt}
                      onChange={(e) => updateSighting(index, 'observedAt', e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">GPS Location *</label>
                  <LocationPicker
                    lat={sighting.lat}
                    lng={sighting.lng}
                    onLocationChange={(newLat, newLng) => {
                      updateSighting(index, 'lat', newLat)
                      updateSighting(index, 'lng', newLng)
                    }}
                  />
                  {sighting.lat && sighting.lng && (
                    <p className="text-xs text-gray-400 mt-1">
                      {sighting.lat.toFixed(5)}, {sighting.lng.toFixed(5)}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
                  <textarea
                    value={sighting.notes}
                    onChange={(e) => updateSighting(index, 'notes', e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Additional notes for this sighting..."
                  />
                </div>

                {/* Media for this sighting */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Photos/Videos</label>
                  <MediaUploader
                    parentType="sighting"
                    parentId={sighting.id ?? null}
                    existingMedia={sighting.media}
                    onExifGps={(exifLat, exifLng) => {
                      if (!sighting.lat && !sighting.lng) {
                        updateSighting(index, 'lat', exifLat)
                        updateSighting(index, 'lng', exifLng)
                      }
                    }}
                    onExifDatetime={(datetime) => {
                      if (!sighting.observedAt) {
                        updateSighting(index, 'observedAt', datetime)
                      }
                    }}
                  />
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Step 3: Additional Notes */}
      <div className="bg-white rounded-xl p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">3. Additional Notes</h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="Any additional observations or notes..."
        />
      </div>

      {/* Step 4: Walk Location (only when no sightings for NOT_SIGHTED) */}
      {!hasSightings && (
        <div className="bg-white rounded-xl p-5 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">4. Walk Location</h2>
          <p className="text-xs text-gray-400">Required when submitting with no sightings</p>
          <LocationPicker
            lat={lat}
            lng={lng}
            onLocationChange={(newLat, newLng) => {
              setLat(newLat)
              setLng(newLng)
            }}
          />
          {lat && lng && (
            <p className="text-xs text-gray-400 mt-1">
              {lat.toFixed(5)}, {lng.toFixed(5)}
            </p>
          )}
        </div>
      )}

      {/* Step 5: Observation-level media (only when no sightings for NOT_SIGHTED) */}
      {!hasSightings && (
        <div className="bg-white rounded-xl p-5 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">5. Photos/Videos</h2>
          <MediaUploader
            parentType="observation"
            parentId={observationId ?? null}
            existingMedia={existingObservation?.media || []}
            onExifGps={(exifLat, exifLng) => {
              if (!lat && !lng) {
                setLat(exifLat)
                setLng(exifLng)
              }
            }}
          />
        </div>
      )}

      {error && (
        <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">{error}</p>
      )}

      {savedMessage && (
        <p className="text-sm text-green-600 bg-green-50 p-3 rounded-lg">{savedMessage}</p>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => handleSaveDraft()}
          disabled={saving}
          className="flex-1 py-3 px-4 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium transition-colors disabled:opacity-50"
        >
          {saving && !submitting ? 'Saving...' : 'Save Draft'}
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving || !walkCompletion}
          className="flex-1 bg-green-600 text-white py-3 px-4 rounded-xl hover:bg-green-700 disabled:opacity-50 font-medium transition-colors"
        >
          {submitting ? 'Submitting...' : 'Submit Report'}
        </button>
      </div>
    </div>
  )
}
