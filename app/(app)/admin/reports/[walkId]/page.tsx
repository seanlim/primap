import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { GroupViewClient } from '@/app/(app)/report/[walkId]/group-view-client'
import { getSlotReportViewData } from '@/lib/report-slot-data'

export const dynamic = 'force-dynamic'

export default async function AdminWalkReportPage({
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

  return (
    <GroupViewClient
      slot={viewData.slot}
      observation={viewData.observations}
      members={viewData.members}
      incidents={viewData.incidents}
      currentUserId={user.id}
      backHref="/admin/reports"
      backLabel="Back to Admin Reports"
      canReportIncident={viewData.isParticipant}
    />
  )
}
