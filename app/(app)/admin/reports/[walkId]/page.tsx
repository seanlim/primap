import { requireSession } from '@/lib/supabase/session'
import { notFound } from 'next/navigation'
import { GroupViewClient } from '@/app/(app)/report/[walkId]/group-view-client'
import { getSlotReportViewData } from '@/lib/report-slot-data'

export const dynamic = 'force-dynamic'

export default async function AdminWalkReportPage({
  params,
}: {
  params: Promise<{ walkId: string }>
}) {
  const { walkId } = await params
  const { supabase, userId } = await requireSession()

  const viewData = await getSlotReportViewData(supabase, walkId, userId)
  if (!viewData) notFound()

  return (
    <GroupViewClient
      slot={viewData.slot}
      observation={viewData.observations}
      members={viewData.members}
      incidents={viewData.incidents}
      currentUserId={userId}
      backHref="/admin/reports"
      backLabel="Back to Admin Reports"
      canReportIncident={viewData.isParticipant}
      canMarkAttendance={viewData.canMarkAttendance}
    />
  )
}
