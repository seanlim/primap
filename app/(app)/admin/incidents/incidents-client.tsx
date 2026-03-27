'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle, CheckCircle } from 'lucide-react'
import { resolveIncident } from '@/lib/actions/admin-round-actions'
import { formatDate } from '@/lib/utils/format-date'
import { useToast } from '@/components/ui/toast'

const TYPE_LABELS: Record<string, string> = {
  INJURED_ANIMAL: 'Injured Animal',
  DEAD_ANIMAL: 'Dead Animal',
  HUMAN_WILDLIFE_CONFLICT: 'Human-Wildlife Conflict',
  HABITAT_DAMAGE: 'Habitat Damage',
  OTHER: 'Other',
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
}

export function IncidentsClient({ incidents }: { incidents: IncidentData[] }) {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Incidents</h1>
      </div>

      <div className="space-y-2">
        {incidents.map(inc => (
          <div key={inc.id} className={`bg-white rounded-2xl p-4 shadow-sm ${inc.resolved ? 'opacity-60' : ''}`}>
            <div className="flex items-start gap-3">
              {inc.resolved ? (
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1">
                <p className="font-medium text-gray-900">{TYPE_LABELS[inc.type] || inc.type}</p>
                <p className="text-sm text-gray-700 mt-1">{inc.description}</p>
                <p className="text-xs text-gray-400 mt-2">
                  {inc.locationName} &middot; {formatDate(inc.walkDate)}
                  &middot; by {inc.reportedBy}
                </p>
                {inc.resolved && inc.resolvedNotes && (
                  <p className="text-xs text-green-600 mt-1">Resolution: {inc.resolvedNotes}</p>
                )}
                {!inc.resolved && (
                  <div className="mt-3">
                    {resolvingId === inc.id ? (
                      <div className="space-y-2">
                        <textarea
                          placeholder="Resolution notes..."
                          value={resolveNotes}
                          onChange={e => setResolveNotes(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <button onClick={() => setResolvingId(null)}
                            className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                          <button onClick={() => handleResolve(inc.id)}
                            className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700">
                            Mark Resolved
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setResolvingId(inc.id)}
                        className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-200">
                        Resolve
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {incidents.length === 0 && (
          <div className="bg-white rounded-xl p-8 text-center shadow-sm">
            <p className="text-gray-500">No incidents reported.</p>
          </div>
        )}
      </div>
    </div>
  )
}
