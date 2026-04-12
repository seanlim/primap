import { createClient } from '@/lib/supabase/server'
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const viewData = await getSlotReportViewData(supabase, walkId, user.id)
  if (!viewData) notFound()
  if (!viewData.isParticipant && !viewData.hasSubmittedOwnObservation) {
    redirect('/report')
  }

  return (
    <GroupViewClient
      slot={viewData.slot}
      observations={viewData.observations}
      members={viewData.members}
      incidents={viewData.incidents}
      currentUserId={user.id}
      canReportIncident={viewData.isParticipant}
    />
  )
}
