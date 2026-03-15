import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft, Users } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface GroupedReport {
  slotId: string
  locationName: string
  walkDate: string
  startTime: string
  roundName: string | null
  submittedAt: string
  reporters: string[]
  submittedCount: number
}

export default async function AdminReportsPage() {
  const supabase = await createClient()

  const { data: observations } = await supabase
    .from('observations')
    .select(`
      id,
      slot_id,
      submitted_at,
      created_at,
      profiles:user_id(full_name, email),
      walk_slots:slot_id(
        location_name,
        walk_date,
        start_time,
        survey_rounds(name)
      )
    `)
    .eq('status', 'SUBMITTED')
    .order('submitted_at', { ascending: false })

  const grouped = new Map<string, GroupedReport>()

  for (const obs of observations || []) {
    const slot = obs.walk_slots as unknown as {
      location_name: string
      walk_date: string
      start_time: string
      survey_rounds: { name: string } | null
    } | null
    if (!slot) continue

    const reporter = obs.profiles as unknown as { full_name: string | null; email: string } | null
    const reporterName = reporter?.full_name || reporter?.email || 'Unknown'
    const timestamp = obs.submitted_at || obs.created_at

    const existing = grouped.get(obs.slot_id)
    if (!existing) {
      grouped.set(obs.slot_id, {
        slotId: obs.slot_id,
        locationName: slot.location_name,
        walkDate: slot.walk_date,
        startTime: slot.start_time,
        roundName: slot.survey_rounds?.name || null,
        submittedAt: timestamp,
        reporters: [reporterName],
        submittedCount: 1,
      })
      continue
    }

    existing.submittedCount += 1
    if (!existing.reporters.includes(reporterName)) {
      existing.reporters.push(reporterName)
    }
    if (new Date(timestamp) > new Date(existing.submittedAt)) {
      existing.submittedAt = timestamp
    }
  }

  const groupedReports = Array.from(grouped.values()).sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Submitted Reports</h1>
      </div>

      {groupedReports.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center shadow-sm">
          <p className="text-gray-500">No submitted reports yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
        {groupedReports.map((report) => (
            <Link
              key={report.slotId}
              href={`/admin/reports/${report.slotId}`}
              className="block bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start gap-4">
                <div>
                  <p className="font-semibold text-gray-900">{report.locationName}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    {new Date(report.walkDate).toLocaleDateString('en-SG', {
                      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
                    })}
                    {report.startTime ? ` · ${report.startTime.slice(0, 5)}` : ''}
                  </p>
                  {report.roundName && (
                    <p className="text-xs text-gray-400 mt-1">{report.roundName}</p>
                  )}
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-green-100 text-green-700">
                  {report.submittedCount} submitted
                </span>
              </div>

              <div className="mt-3 text-xs text-gray-500 space-y-1">
                <p className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {report.reporters.join(', ')}
                </p>
                <p>
                  Latest submission {new Date(report.submittedAt).toLocaleString('en-SG')}
                </p>
              </div>
            </Link>
          ))}             
        </div>
      )}
    </div>
  )
}
