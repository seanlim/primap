'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle } from 'lucide-react'
import { resolveIncident } from '@/lib/actions/admin-round-actions'
import { formatDate } from '@/lib/utils/format-date'
import { useToast } from '@/components/ui/toast'
import { MediaGallery } from '@/components/report/media-gallery'
import { INCIDENT_TYPE_LABELS, type IncidentType } from '@/lib/constants/incident-types'

interface IncidentMediaItem {
  id: string
  file_path: string
  file_name: string
  media_type: string
}

interface IncidentData {
  id: string
  type: string
  description: string
  resolved: boolean
  resolvedNotes: string | null
  reportedBy: string
  locationName: string
  walkDate: string
  createdAt: string
  media: IncidentMediaItem[]
}

interface IncidentWalkGroup {
  walkId: string
  locationName: string
  walkDate: string
  incidents: IncidentData[]
}

interface IncidentRoundGroup {
  roundId: string | null
  roundName: string
  roundStartDate: string | null
  walks: IncidentWalkGroup[]
}

export function IncidentsClient({
  incidentGroups,
}: {
  incidentGroups: IncidentRoundGroup[]
}) {
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [resolveNotes, setResolveNotes] = useState('')
  const router = useRouter()
  const { showToast } = useToast()

  const handleResolve = async (id: string) => {
    const result = await resolveIncident(id, resolveNotes)
    if (result.error) showToast(result.error, 'error')
    else {
      setResolvingId(null)
      setResolveNotes('')
      router.refresh()
    }
  }

  if (incidentGroups.length === 0) {
    return (
      <div className="rounded-xl bg-white p-8 text-center shadow-sm">
        <p className="text-gray-500">No incidents reported.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {incidentGroups.map((group) => (
        <section key={group.roundId || group.roundName} className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="border-b border-gray-100 bg-gray-50/80 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">{group.roundName}</h2>
                <p className="mt-1 text-xs text-gray-500">
                  {group.walks.length} walk{group.walks.length === 1 ? '' : 's'} with incidents
                </p>
              </div>
              <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-500 ring-1 ring-gray-200">
                Sorted by date
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-100">
            {group.walks.map((walk) => (
              <div key={walk.walkId} className="px-4 py-4">
                <div className="mb-3 rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-3">
                  <p className="font-medium text-gray-900">{walk.locationName}</p>
                  <p className="mt-1 text-sm text-gray-500">{formatDate(walk.walkDate)}</p>
                </div>

                <div className="space-y-2">
                  {walk.incidents.map((inc) => (
                    <div key={inc.id} className={`rounded-xl bg-white p-4 ${inc.resolved ? 'opacity-60' : ''}`}>
                      <div className="flex items-start gap-3">
                        {inc.resolved ? (
                          <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                        ) : (
                          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900">{INCIDENT_TYPE_LABELS[inc.type as IncidentType] || inc.type}</p>
                          <p className="mt-1 text-sm text-gray-700">{inc.description}</p>
                          <p className="mt-2 text-xs text-gray-400">
                            by {inc.reportedBy} · {new Date(inc.createdAt).toLocaleString('en-SG')}
                          </p>
                          <MediaGallery media={inc.media} bucket="incident-media" />
                          {inc.resolved && inc.resolvedNotes && (
                            <p className="mt-1 text-xs text-green-600">Resolution: {inc.resolvedNotes}</p>
                          )}
                          {!inc.resolved && (
                            <div className="mt-3">
                              {resolvingId === inc.id ? (
                                <div className="space-y-2">
                                  <textarea
                                    placeholder="Resolution notes..."
                                    value={resolveNotes}
                                    onChange={e => setResolveNotes(e.target.value)}
                                    className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                    rows={2}
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => setResolvingId(null)}
                                      className="text-xs text-gray-500 hover:text-gray-700"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      onClick={() => handleResolve(inc.id)}
                                      className="rounded-lg bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-700"
                                    >
                                      Mark Resolved
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setResolvingId(inc.id)}
                                  className="rounded-lg bg-green-100 px-3 py-1.5 text-xs text-green-700 hover:bg-green-200"
                                >
                                  Resolve
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
