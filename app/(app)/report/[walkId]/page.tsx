import { requireSession } from '@/lib/supabase/session'
import { redirect, notFound } from 'next/navigation'
import { GroupViewClient } from './group-view-client'
import { getSlotReportViewData } from '@/lib/report-slot-data'

export const dynamic = 'force-dynamic'

export default async function WalkReportPage({
  params,
}: {
  params: Promise<{ walkId: string }>
}) {
  const { walkId } = await params
  const { supabase, userId } = await requireSession()

  const viewData = await getSlotReportViewData(supabase, walkId, userId)
  if (!viewData) notFound()
  if (!viewData.isParticipant && !viewData.hasSubmittedOwnObservation) {
    redirect('/report')
  }

  return (
    <GroupViewClient
      slot={viewData.slot}
      observation={viewData.observations}
      members={viewData.members}
      incidents={viewData.incidents}
      currentUserId={userId}
      canReportIncident={viewData.isParticipant}
      canMarkAttendance={viewData.canMarkAttendance}
    />
  )
}
