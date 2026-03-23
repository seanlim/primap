import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDate } from '@/lib/utils/format-date'
import type { WalkRef } from '@/lib/types/supabase-helpers'

export const dynamic = 'force-dynamic'

export default async function ReportListPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [membershipResult, submittedResult] = await Promise.all([
    supabase
      .from('slot_memberships')
      .select(`
        id,
        status,
        walk_slots (
          id,
          location_name,
          walk_date,
          start_time,
          end_time,
          survey_rounds (name)
        )
      `)
      .eq('user_id', user.id)
      .eq('status', 'ACTIVE')
      .order('joined_at', { ascending: false }),
    supabase
      .from('observations')
      .select(`
        id,
        slot_id,
        status,
        walk_slots (
          id,
          location_name,
          walk_date,
          start_time,
          end_time,
          survey_rounds (name)
        )
      `)
      .eq('user_id', user.id)
      .eq('status', 'SUBMITTED'),
  ])

  const memberships = membershipResult.data || []
  const submittedObservations = submittedResult.data || []

  const reportItems = new Map<string, {
    key: string
    href: string
    locationName: string
    walkDate: string
    startTime: string
    roundName: string | null
    statusLabel: string
    statusColor: string
    sortKey: string
  }>()

  for (const membership of memberships) {
    const slot = membership.walk_slots as unknown as WalkRef
    if (!slot) continue
    reportItems.set(slot.id, {
      key: membership.id,
      href: `/report/${slot.id}`,
      locationName: slot.location_name,
      walkDate: slot.walk_date,
      startTime: slot.start_time,
      roundName: slot.survey_rounds?.name || null,
      statusLabel: 'Draft',
      statusColor: 'bg-yellow-100 text-yellow-700',
      sortKey: `${slot.walk_date}T${slot.start_time}`,
    })
  }

  // Get user's observations to check report status per active slot
  const slotIds = memberships.map(m => {
    const slot = m.walk_slots as unknown as WalkRef
    return slot?.id
  }).filter(Boolean)

  const { data: observations } = slotIds.length > 0
    ? await supabase
        .from('observations')
        .select('id, slot_id, status')
        .eq('user_id', user.id)
        .in('slot_id', slotIds)
    : { data: [] }

  const observationMap = new Map(
    (observations || []).map(o => [o.slot_id, { id: o.id, status: o.status }])
  )

  for (const membership of memberships) {
    const slot = membership.walk_slots as unknown as WalkRef
    if (!slot) continue

    const obs = observationMap.get(slot.id)
    const statusLabel = !obs
      ? 'No Report'
      : obs.status === 'DRAFT'
      ? 'Draft'
      : 'Submitted'
    const statusColor = !obs
      ? 'bg-gray-100 text-gray-500'
      : obs.status === 'DRAFT'
      ? 'bg-yellow-100 text-yellow-700'
      : 'bg-green-100 text-green-700'

    reportItems.set(slot.id, {
      key: membership.id,
      href: `/report/${slot.id}`,
      locationName: slot.location_name,
      walkDate: slot.walk_date,
      startTime: slot.start_time,
      roundName: slot.survey_rounds?.name || null,
      statusLabel,
      statusColor,
      sortKey: `${slot.walk_date}T${slot.start_time}`,
    })
  }

  for (const observation of submittedObservations) {
    if (reportItems.has(observation.slot_id)) continue

    const slot = observation.walk_slots as unknown as WalkRef
    if (!slot) continue

    reportItems.set(slot.id, {
      key: observation.id,
      href: `/report/${slot.id}`,
      locationName: slot.location_name,
      walkDate: slot.walk_date,
      startTime: slot.start_time,
      roundName: slot.survey_rounds?.name || null,
      statusLabel: 'Submitted',
      statusColor: 'bg-green-100 text-green-700',
      sortKey: `${slot.walk_date}T${slot.start_time}`,
    })
  }

  const items = Array.from(reportItems.values())
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Reports</h1>

      {items.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center shadow-sm">
          <p className="text-gray-500">No walks to report on yet.</p>
          <Link href="/walk" className="text-green-600 font-medium text-sm hover:underline mt-2 inline-block">
            Join a walk first
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            return (
              <Link
                key={item.key}
                href={item.href}
                className="block bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-gray-900">{item.locationName}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {formatDate(item.walkDate, 'short')} &middot; {item.startTime.slice(0, 5)}
                    </p>
                    {item.roundName && (
                      <p className="text-xs text-gray-400 mt-1">{item.roundName}</p>
                    )}
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${item.statusColor}`}>
                    {item.statusLabel}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
