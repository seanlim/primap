'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { reportIncident } from '@/lib/actions/incident-actions'
import { MediaUploader } from '@/components/report/media-uploader'
import { INCIDENT_TYPES, type IncidentType } from '@/lib/constants/incident-types'

interface IncidentModalProps {
  walkId: string
  onClose: () => void
  onSubmitted: () => void
}

/**
 * Two-phase incident report flow:
 *   Phase 1 (Details): collect type + description, create the incident row.
 *   Phase 2 (Media):   attach photos/videos to the just-created incident.
 *
 * Once phase 1 succeeds the incident is committed — text-only submissions
 * are valid, so closing the modal in phase 2 (Done/Skip) finalizes without
 * any rollback. Backdrop dismiss is blocked while uploads are in flight to
 * prevent accidental abandonment of files mid-upload.
 */
export function IncidentModal({ walkId, onClose, onSubmitted }: IncidentModalProps) {
  const [phase, setPhase] = useState<'details' | 'media'>('details')
  const [type, setType] = useState<string>('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [incidentId, setIncidentId] = useState<string | null>(null)
  const [uploadingCount, setUploadingCount] = useState(0)
  const isUploading = uploadingCount > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!type || !description) return
    setLoading(true)
    setError('')

    const result = await reportIncident({
      walkId,
      incidentType: type as IncidentType,
      description,
    })

    if ('error' in result) {
      setError(result.error)
      setLoading(false)
      return
    }

    setIncidentId(result.incidentId)
    setPhase('media')
    setLoading(false)
  }

  const handleBackdropClick = () => {
    if (phase === 'details') {
      onClose()
      return
    }
    if (isUploading) return // block dismissal while uploads run
    onSubmitted()
  }

  const modal = (
    <div
      data-testid="incident-modal-root"
      className="fixed inset-0 flex items-end justify-center sm:items-center"
      style={{ zIndex: 1000 }}
    >
      <div className="fixed inset-0 bg-black/50" onClick={handleBackdropClick} />
      <div
        className="relative max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl"
        style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
      >
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          {phase === 'details' ? 'Report Incident' : 'Add Photos / Videos'}
        </h2>

        {phase === 'details' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Incident Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-sm bg-white"
                required
              >
                <option value="">Select type...</option>
                {INCIDENT_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-sm resize-none"
                placeholder="Describe the incident..."
                required
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !type || !description}
                className="flex-1 bg-red-600 text-white py-3 px-4 rounded-xl hover:bg-red-700 disabled:opacity-50 font-medium transition-colors text-sm"
              >
                {loading ? 'Submitting...' : 'Report'}
              </button>
            </div>
          </form>
        )}

        {phase === 'media' && incidentId && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Incident saved. Add supporting photos or videos so administrators can follow up — or skip if you have nothing to attach.
            </p>
            <MediaUploader
              parentType="incident"
              parentId={incidentId}
              existingMedia={[]}
              label="Photos / Videos"
              onUploadingChange={setUploadingCount}
            />
            {isUploading && (
              <p className="text-xs text-gray-500" role="status">
                Uploading {uploadingCount} file{uploadingCount === 1 ? '' : 's'}… please wait before closing.
              </p>
            )}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onSubmitted}
                disabled={isUploading}
                className="flex-1 py-3 px-4 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors text-sm"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={onSubmitted}
                disabled={isUploading}
                className="flex-1 bg-red-600 text-white py-3 px-4 rounded-xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors text-sm"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null

  return createPortal(modal, document.body)
}
