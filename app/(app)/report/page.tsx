import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDate } from '@/lib/utils/format-date'
import { ClipboardList } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

export const dynamic = 'force-dynamic'

export default async function ReportListPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get all slots the user is a member of
  const { data: memberships } = await supabase
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
    .order('joined_at', { ascending: false })

  const { data: observations } =  await supabase
        .from('observations')
        .select('id, slot_id, status')
        .eq('user_id', user.id)

  const observationMap = new Map(
    (observations || []).map(o => [o.slot_id,  o.status ])
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-gray-900">Reports</h1>

      {(!memberships || memberships.length === 0) ? (
        <EmptyState
          icon={ClipboardList}
          title="No walks to report on yet"
          description="Join a walk first to start submitting reports"
          action={{ label: 'Browse Walks', href: '/walk' }}
          color="green"
        />
      ) : (
        <div className="space-y-2 stagger-children">
          {memberships.map((membership) => {
            const slot = membership.walk_slots;
            const status = observationMap.get(slot.id)

            const statusLabel = !status
              ? 'No Report'
              : status === 'DRAFT'
              ? 'Draft'
              : 'Submitted'
            const statusColor = !status
              ? 'bg-gray-100 text-gray-500'
              : status === 'DRAFT'
              ? 'bg-yellow-100 text-yellow-700'
              : 'bg-green-100 text-green-700'

            return (
              <Link
                key={membership.id}
                href={`/report/${slot.id}`}
                className="block bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-gray-900">{slot.location_name}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {formatDate(slot.walk_date, 'short')} &middot; {slot.start_time.slice(0, 5)}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{slot.survey_rounds.name}</p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColor}`}>
                    {statusLabel}
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
