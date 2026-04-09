'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronDown, ChevronUp, MapPin, Eye, AlertTriangle, ArrowLeft } from 'lucide-react'
import { submitObservation } from '@/lib/actions/observation-actions'
import { formatDate } from '@/lib/utils/format-date'
import { useToast } from '@/components/ui/toast'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { MediaGallery } from '@/components/report/media-gallery'
import { INCIDENT_TYPE_LABELS, type IncidentType } from '@/lib/constants/incident-types'
import { IncidentModal } from './incident-modal'

interface SightingData {
  id: string
  species: string
  speciesOther: string | null
  count: string
  observedAt: string | null
  lat: number
  lng: number
  notes: string | null
  media: { id: string; file_path: string; file_name: string; media_type: string }[]
}

interface ObservationData {
  id: string
  userId: string
  userName: string
  walkCompletion: string | null
  outcome: string | null
  notes: string | null
  lat: number | null
  lng: number | null
  status: string
  submittedAt: string | null
  sightings: SightingData[]
  media: { id: string; file_path: string; file_name: string; media_type: string }[]
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
  observations: ObservationData[]
  members: { userId: string; fullName: string | null; email: string }[]
  incidents: {
    id: string
    type: string
    description: string
    reportedBy: string
    createdAt: string
    resolved: boolean
    media: { id: string; file_path: string; file_name: string; media_type: string }[]
  }[]
  currentUserId: string
  backHref?: string
  backLabel?: string
  canReportIncident?: boolean
}

const SPECIES_LABELS: Record<string, string> = {
  RBL: "Raffles' Banded Langur",
  LTM: 'Long-tailed Macaque',
  DUSKY: 'Dusky Langur',
  OTHER: 'Other',
}


export function GroupViewClient({
  slot,
  observations,
  members,
  incidents,
  currentUserId,
  backHref = '/report',
  backLabel = 'Back to Reports',
  // Default fail-closed: callers must explicitly grant the permission. Both
  // current call sites pass `viewData.isParticipant`; this default protects
  // against future call sites that might forget.
  canReportIncident = false,
}: Props) {
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())
  const [showIncidentModal, setShowIncidentModal] = useState(false)
  const [showSubmitDialog, setShowSubmitDialog] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()
  const { showToast } = useToast()
  const isAdminView = backHref.startsWith('/admin')

  const myObservation = observations.find(o => o.userId === currentUserId)
  const othersObservations = observations.filter(o => o.userId !== currentUserId)

  const toggleCard = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSubmit = () => {
    if (!myObservation) return
    setShowSubmitDialog(true)
  }

  const confirmSubmit = async () => {
    if (!myObservation) return
    setShowSubmitDialog(false)
    setSubmitting(true)
    const result = await submitObservation(myObservation.id, slot.id)
    if (result.error) {
      showToast(result.error, 'error')
    } else {
      router.refresh()
    }
    setSubmitting(false)
  }

  return (
    <div className="space-y-6">
      {isAdminView ? (
        <div className="flex items-center gap-4">
          <Link href={backHref} className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        </div>
      ) : (
        <Breadcrumb items={[
          { label: backLabel === 'Back to Reports' ? 'Reports' : 'Admin Reports', href: backHref },
          { label: slot.locationName },
        ]} />
      )}

      {/* Walk Header */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <p className="text-xs text-green-600 font-medium">{slot.roundName}</p>
        <h1 className="text-xl font-bold text-gray-900 mt-1">{slot.locationName}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {formatDate(slot.walkDate, 'full')} &middot; {slot.startTime.slice(0, 5)} - {slot.endTime.slice(0, 5)}
        </p>
      </div>

      {/* Your Report */}
      {myObservation && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="font-medium text-gray-900">Your Report</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  myObservation.status === 'SUBMITTED'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {myObservation.status}
                </span>
              </div>
              {myObservation.status === 'DRAFT' && (
                <div className="flex items-center gap-2">
                  <Link
                    href={`/report/${slot.id}/edit`}
                    className="text-sm bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200 font-medium transition-colors"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="text-sm bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 font-medium transition-colors disabled:opacity-50"
                  >
                    {submitting ? 'Submitting...' : 'Submit'}
                  </button>
                </div>
              )}
            </div>
            {myObservation.status === 'SUBMITTED' && myObservation.submittedAt && (
              <p className="text-xs text-gray-400 mt-0.5">
                Submitted {formatDate(myObservation.submittedAt)}
              </p>
            )}
          </div>
          <ObservationDetails observation={myObservation} />
        </div>
      )}

      {/* Others' Reports */}
      {othersObservations.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
            Group Reports ({othersObservations.length})
          </h2>
          {othersObservations.map(obs => (
            <div key={obs.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <button
                onClick={() => toggleCard(obs.id)}
                className="w-full p-4 flex items-center justify-between text-left"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">{obs.userName}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      obs.status === 'SUBMITTED'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {obs.status}
                    </span>
                  </div>
                  {obs.outcome && (
                    <span className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                      <Eye className="w-3 h-3" />
                      {obs.outcome === 'SIGHTED' ? `${obs.sightings.length} sighting(s)` : 'Not Sighted'}
                    </span>
                  )}
                </div>
                {expandedCards.has(obs.id) ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>
              {expandedCards.has(obs.id) && (
                <div className="border-t border-gray-100">
                  <ObservationDetails observation={obs} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Members without reports */}
      {(() => {
        const reportedUserIds = new Set(observations.map(o => o.userId))
        const noReportMembers = members.filter(m => !reportedUserIds.has(m.userId) && m.userId !== currentUserId)
        if (noReportMembers.length === 0) return null
        return (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">No Report Yet</h2>
            {noReportMembers.map(m => (
              <div key={m.userId} className="bg-white rounded-xl p-4 shadow-sm opacity-60">
                <p className="text-sm text-gray-500">{m.fullName || m.email}</p>
              </div>
            ))}
          </div>
        )
      })()}

      {/* Incidents */}
      {incidents.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Incidents</h2>
          {incidents.map(inc => (
            <div key={inc.id} className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-red-800">
                    {INCIDENT_TYPE_LABELS[inc.type as IncidentType] || inc.type}
                  </p>
                  <p className="text-sm text-red-700 mt-1">{inc.description}</p>
                  <p className="text-xs text-red-400 mt-2">
                    Reported by {inc.reportedBy} &middot; {formatDate(inc.createdAt)}
                  </p>
                  <MediaGallery media={inc.media} bucket="incident-media" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Report Incident Button */}
      {canReportIncident && (
        <button
          onClick={() => setShowIncidentModal(true)}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 font-medium transition-colors text-sm"
        >
          <AlertTriangle className="w-4 h-4" />
          Report Incident
        </button>
      )}

      {/* Incident Modal */}
      {showIncidentModal && canReportIncident && (
        <IncidentModal
          walkId={slot.id}
          onClose={() => setShowIncidentModal(false)}
          onSubmitted={() => {
            setShowIncidentModal(false)
            router.refresh()
          }}
        />
      )}

      <ConfirmationDialog
        open={showSubmitDialog}
        title="Submit Report"
        message="Submit this report? You won't be able to edit it after submission."
        confirmLabel="Submit"
        onConfirm={confirmSubmit}
        onCancel={() => setShowSubmitDialog(false)}
      />
    </div>
  )
}

function ObservationDetails({ observation }: { observation: ObservationData }) {
  return (
    <div className="p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {observation.walkCompletion && (
          <div>
            <p className="text-xs text-gray-400">Walk Completion</p>
            <p className="text-sm font-medium text-gray-700">{observation.walkCompletion}</p>
          </div>
        )}
        {observation.outcome && (
          <div>
            <p className="text-xs text-gray-400">Outcome</p>
            <p className="text-sm font-medium text-gray-700">
              {observation.outcome === 'SIGHTED' ? 'Sighted' : 'Not Sighted'}
            </p>
          </div>
        )}
      </div>

      {observation.notes && (
        <div>
          <p className="text-xs text-gray-400">Notes</p>
          <p className="text-sm text-gray-700 mt-1">{observation.notes}</p>
        </div>
      )}

      {observation.outcome === 'NOT_SIGHTED' && observation.lat && observation.lng && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <MapPin className="w-4 h-4" />
          {observation.lat.toFixed(5)}, {observation.lng.toFixed(5)}
        </div>
      )}

      {/* Observation-level media (NOT_SIGHTED) */}
      {observation.outcome === 'NOT_SIGHTED' && observation.media.length > 0 && (
        <MediaGallery media={observation.media} />
      )}

      {observation.sightings.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-400 font-medium">Sightings ({observation.sightings.length})</p>
          {observation.sightings.map((sighting, i) => (
            <div key={sighting.id} className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900">
                  #{i + 1} {sighting.species === 'OTHER' ? `Other: ${sighting.speciesOther || 'Unknown'}` : (SPECIES_LABELS[sighting.species] || sighting.species)}
                </p>
                <span className="text-xs text-gray-500">Count: {sighting.count}</span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                <MapPin className="w-3 h-3" />
                {sighting.lat.toFixed(5)}, {sighting.lng.toFixed(5)}
              </div>
              {sighting.observedAt && (
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(sighting.observedAt).toLocaleString('en-SG', { timeZone: 'UTC' })}
                </p>
              )}
              {sighting.notes && (
                <p className="text-xs text-gray-600 mt-1">{sighting.notes}</p>
              )}
              {/* Sighting-level media */}
              <MediaGallery media={sighting.media} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

