'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils/format-date'
import { adminUpdateObservation, adminDeleteMedia } from '@/lib/actions/admin-observation-actions'
import { LocationPicker } from '@/components/map/location-picker'
import { MediaUploader, type MediaItem } from '@/components/report/media-uploader'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'

interface SightingData {
  id: string
  species: string
  speciesOther: string | null
  count: string
  observedAt: string | null
  lat: number
  lng: number
  notes: string | null
  media: MediaItem[]
}

interface ObservationData {
  id: string
  members: { userId: string; userName: string }[]
  slotId: string
  walkCompletion: string | null
  outcome: string | null
  notes: string | null
  lat: number | null
  lng: number | null
  status: string
  sightings: SightingData[]
  media: MediaItem[]
}

interface SightingForm {
  id?: string
  clientTempId: string
  species: 'RBL' | 'LTM' | 'DUSKY' | 'OTHER' | ''
  speciesOther: string
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
  observation: ObservationData
  maxMediaPerReport: number
}

const WALK_COMPLETION_OPTIONS = [
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'PARTIAL', label: 'Partial' },
  { value: 'ABORTED', label: 'Aborted' },
] as const

const SPECIES_OPTIONS = [
  { value: 'RBL', label: "Raffles' Banded Langur" },
  { value: 'LTM', label: 'Long-tailed Macaque' },
  { value: 'DUSKY', label: 'Dusky Langur' },
  { value: 'OTHER', label: 'Other (specify)' },
]

export function AdminEditFormClient({ slot, observation, maxMediaPerReport }: Props) {
  const router = useRouter()
  const [walkCompletion, setWalkCompletion] = useState(observation.walkCompletion ?? 'COMPLETED')
  const [notes, setNotes] = useState(observation.notes ?? '')
  const [lat, setLat] = useState<number | null>(observation.lat ?? null)
  const [lng, setLng] = useState<number | null>(observation.lng ?? null)
  const [sightings, setSightings] = useState<SightingForm[]>(
    observation.sightings.map(s => ({
      id: s.id,
      clientTempId: s.id,
      species: s.species as SightingForm['species'],
      speciesOther: s.speciesOther || '',
      count: s.count,
      observedAt: s.observedAt || '',
      lat: s.lat,
      lng: s.lng,
      notes: s.notes || '',
      media: s.media || [],
    }))
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showSaveDialog, setShowSaveDialog] = useState(false)

  const hasSightings = sightings.some(s => s.species)

  const addSighting = () => {
    setSightings(prev => [...prev, {
      clientTempId: crypto.randomUUID(),
      species: '',
      speciesOther: '',
      count: '1',
      observedAt: '',
      lat: null,
      lng: null,
      notes: '',
      media: [],
    }])
  }

  const removeSighting = (index: number) => {
    setSightings(prev => prev.filter((_, i) => i !== index))
  }

  const updateSighting = (index: number, field: keyof SightingForm, value: string | number | null) => {
    setSightings(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s))
  }

  const handleSave = () => {
    setError('')

    // Client-side validation
    if (hasSightings) {
      for (const s of sightings.filter(s => s.species)) {
        if (!s.lat || !s.lng) {
          setError('GPS location is required for each sighting.')
          return
        }
        if (s.species === 'OTHER' && !s.speciesOther.trim()) {
          setError('Species name is required when "Other" is selected.')
          return
        }
      }
    } else if (!lat || !lng) {
      setError('GPS location is required for Not Sighted reports.')
      return
    }

    setShowSaveDialog(true)
  }

  const confirmSave = async () => {
    setSaving(true)
    setError('')

    const validSightings = sightings.filter(s => s.species)
    const outcome = validSightings.length > 0 ? 'SIGHTED' : 'NOT_SIGHTED'

    const result = await adminUpdateObservation({
      observationId: observation.id,
      walkId: slot.id,
      walkCompletion: walkCompletion as 'COMPLETED' | 'PARTIAL' | 'ABORTED',
      outcome,
      notes: notes || undefined,
      lat: lat ?? undefined,
      lng: lng ?? undefined,
      sightings: validSightings.map(s => ({
        id: s.id,
        species: s.species as 'RBL' | 'LTM' | 'DUSKY' | 'OTHER',
        species_other: s.speciesOther || undefined,
        count: s.count || '1',
        observed_at: s.observedAt || undefined,
        lat: s.lat || 0,
        lng: s.lng || 0,
        notes: s.notes || undefined,
      })),
    })

    setShowSaveDialog(false)
    setSaving(false)

    if (result.error) {
      setError(result.error)
    } else {
      router.push(`/admin/reports/${slot.id}`)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/admin/reports/${slot.id}`} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Report</h1>
          <div className="text-sm text-gray-500">
            <span>{slot.locationName} &middot; {formatDate(slot.walkDate, 'compact')}</span>
            <ul className="list-disc list-inside">
              {observation.members.map((member) => (
                <li key={member.userId}>{member.userName}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
        <p className="text-sm text-amber-800">
          You are editing this report as an admin. Changes will be applied directly to the submitted report.
        </p>
      </div>

      {/* Walk Completion */}
      <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Walk Completion</h2>
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

      {/* Sightings */}
      <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Sightings</h2>
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
            No sightings — report will be saved as &quot;Not Sighted&quot;
          </p>
        )}

        {sightings.map((sighting, index) => (
          <div key={sighting.clientTempId} className="border border-gray-200 rounded-xl p-4 space-y-3">
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

            {sighting.species === 'OTHER' && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Species Name *</label>
                <input
                  type="text"
                  value={sighting.speciesOther}
                  onChange={(e) => updateSighting(index, 'speciesOther', e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Enter species name..."
                />
              </div>
            )}

            {sighting.species && (
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

                <div>
                  {sighting.id ? (
                    <MediaUploader
                      label="Photos/Videos"
                      parentType="sighting"
                      parentId={sighting.id}
                      clientParentId={sighting.clientTempId}
                      existingMedia={sighting.media}
                      maxFiles={maxMediaPerReport}
                      onDeleteMedia={adminDeleteMedia}
                      readOnly
                    />
                  ) : (
                    <p className="text-xs text-gray-400 italic">
                      Save changes first to manage photos for this sighting.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Notes */}
      <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Additional Notes</h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="Any additional observations or notes..."
        />
      </div>

      {/* Walk Location (only when no sightings for NOT_SIGHTED) */}
      {!hasSightings && (
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Walk Location</h2>
          <p className="text-xs text-gray-400">Required for Not Sighted reports</p>
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

      {/* Observation-level media (only when no sightings for NOT_SIGHTED) */}
      {!hasSightings && (
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Photos/Videos</h2>
          <MediaUploader
            label="Photos/Videos"
            parentType="observation"
            parentId={observation.id}
            clientParentId={observation.id}
            existingMedia={observation.media}
            maxFiles={maxMediaPerReport}
            onDeleteMedia={adminDeleteMedia}
            readOnly
          />
        </div>
      )}

      {error && (
        <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">{error}</p>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Link
          href={`/admin/reports/${slot.id}`}
          className="flex-1 py-3 px-4 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium transition-colors text-center"
        >
          Cancel
        </Link>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 bg-green-600 text-white py-3 px-4 rounded-xl hover:bg-green-700 disabled:opacity-50 font-medium transition-colors"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <ConfirmationDialog
        open={showSaveDialog}
        title="Save Changes"
        message="Save changes to this report? This will overwrite the original submission."
        confirmLabel="Save"
        busy={saving}
        onConfirm={confirmSave}
        onCancel={() => {
          if (saving) return
          setShowSaveDialog(false)
        }}
      />
    </div>
  )
}
