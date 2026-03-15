import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { GroupViewClient } from '@/app/(app)/report/[slotId]/group-view-client'
import { getSlotReportViewData } from '@/lib/report-slot-data'

export const dynamic = 'force-dynamic'

export default async function AdminSlotReportPage({
  params,
}: {
  params: Promise<{ slotId: string }>
}) {
  const { slotId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const viewData = await getSlotReportViewData(supabase, slotId, user.id)
  if (!viewData) notFound()

  return (
    <GroupViewClient
      slot={viewData.slot}
      observations={viewData.observations}
      members={viewData.members}
      incidents={viewData.incidents}
      currentUserId={user.id}
      backHref="/admin/reports"
      backLabel="Back to Admin Reports"
      canReportIncident={viewData.isParticipant}
    />
  )
}
