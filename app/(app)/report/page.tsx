import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDate } from '@/lib/utils/format-date'
import { ClipboardList, Search } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import type { WalkRef } from '@/lib/types/supabase-helpers'
import { hasWalkEnded, hasWalkStarted } from '@/lib/utils/walk-participation'

export const dynamic = 'force-dynamic'

type ReportItem = {
  key: string
  href: string
  locationName: string
  walkDate: string
  startTime: string
  roundName: string | null
  statusLabel: 'No Report' | 'Draft' | 'Submitted' | 'Upcoming'
  statusColor: string
  sortKey: string
}

function ReportCard({ item }: { item: ReportItem }) {
  return (
    <Link
      key={item.key}
      href={item.href}
      className="block bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900">{item.locationName}</p>
          <p className="text-sm text-gray-600 mt-1">
            {formatDate(item.walkDate, 'short')} &middot; {item.startTime.slice(0, 5)}
          </p>
          {item.roundName && (
            <p className="text-xs text-gray-400 mt-1">{item.roundName}</p>
          )}
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${item.statusColor}`}>
          {item.statusLabel}
        </span>
      </div>
    </Link>
  )
}

function ReportSection({
  title,
  items,
  emptyTitle,
  emptyDescription,
  emptyIcon = ClipboardList,
}: {
  title: string
  items: ReportItem[]
  emptyTitle: string
  emptyDescription?: string
  emptyIcon?: typeof ClipboardList
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
          {title} {items.length > 0 && `(${items.length})`}
        </h2>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={emptyIcon}
          title={emptyTitle}
          description={emptyDescription}
          color="blue"
        />
      ) : (
        <div className="space-y-2 stagger-children">
          {items.map((item) => (
            <ReportCard key={item.key} item={item} />
          ))}
        </div>
      )}
    </section>
  )
}

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

  const slotIds = memberships
    .map((membership) => {
      const slot = membership.walk_slots as unknown as WalkRef | null
      return slot?.id
    })
    .filter((id): id is string => Boolean(id))

  const { data: observations } = slotIds.length > 0
    ? await supabase
        .from('observations')
        .select('id, slot_id, status')
        .eq('user_id', user.id)
        .in('slot_id', slotIds)
    : { data: [] }

  const observationMap = new Map(
    (observations || []).map((observation) => [
      observation.slot_id,
      { id: observation.id, status: observation.status },
    ])
  )

  const needsActionItems: ReportItem[] = []
  const upcomingWalkItems: ReportItem[] = []
  const submittedHistoryItems: ReportItem[] = []

  for (const membership of memberships) {
    const slot = membership.walk_slots as unknown as WalkRef | null
    if (!slot) continue

    const observation = observationMap.get(slot.id)
    const baseItem = {
      href: `/report/${slot.id}`,
      locationName: slot.location_name,
      walkDate: slot.walk_date,
      startTime: slot.start_time,
      roundName: slot.survey_rounds?.name || null,
      sortKey: `${slot.walk_date}T${slot.start_time}`,
    }

    if (observation?.status === 'DRAFT') {
      const draftItem = {
        key: observation.id,
        ...baseItem,
        statusLabel: 'Draft',
        statusColor: 'bg-yellow-100 text-yellow-700',
      }

      if (hasWalkStarted(slot.walk_date, slot.start_time)) {
        needsActionItems.push(draftItem)
      } else {
        upcomingWalkItems.push(draftItem)
      }
      continue
    }

    if (observation?.status === 'SUBMITTED') {
      submittedHistoryItems.push({
        key: observation.id,
        ...baseItem,
        statusLabel: 'Submitted',
        statusColor: 'bg-green-100 text-green-700',
      })
      continue
    }

    if (hasWalkStarted(slot.walk_date, slot.start_time)) {
      needsActionItems.push({
        key: membership.id,
        ...baseItem,
        statusLabel: 'No Report',
        statusColor: 'bg-gray-100 text-gray-500',
      })
      continue
    }

    upcomingWalkItems.push({
      key: membership.id,
      ...baseItem,
      statusLabel: 'Upcoming',
      statusColor: 'bg-blue-100 text-blue-700',
    })
  }

  for (const observation of submittedObservations) {
    if (slotIds.includes(observation.slot_id)) continue

    const slot = observation.walk_slots as unknown as WalkRef | null
    if (!slot) continue
    if (!hasWalkEnded(slot.walk_date, slot.end_time)) continue

    submittedHistoryItems.push({
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

  const byNewest = (left: ReportItem, right: ReportItem) => right.sortKey.localeCompare(left.sortKey)
  const bySoonest = (left: ReportItem, right: ReportItem) => left.sortKey.localeCompare(right.sortKey)

  const needsAction = needsActionItems.sort(byNewest)
  const upcomingWalks = upcomingWalkItems.sort(bySoonest)
  const submittedHistory = submittedHistoryItems.sort(byNewest)
  const hasAnyItems = needsAction.length > 0 || upcomingWalks.length > 0 || submittedHistory.length > 0

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-gray-900">Reports</h1>

      {!hasAnyItems ? (
        <EmptyState
          icon={ClipboardList}
          title="No reports yet"
          description="Join a walk first to start drafting and submitting reports."
          action={{ label: 'Browse Walks', href: '/walk' }}
          color="green"
        />
      ) : (
        <>
          <ReportSection
            title="Needs Action"
            items={needsAction}
            emptyTitle="Nothing needs attention right now"
            emptyDescription="Started walks that need your report will appear here."
          />

          <ReportSection
            title="Submitted"
            items={submittedHistory}
            emptyTitle="No submitted reports yet"
            emptyDescription="Your submitted reports will appear here."
          />

          <ReportSection
            title="Upcoming Walks"
            items={upcomingWalks}
            emptyTitle="No upcoming walks"
            emptyDescription="Your upcoming joined walks will appear here."
            emptyIcon={Search}
          />
        </>
      )}
    </div>
  )
}
