import { requireSession } from '@/lib/supabase/session'
import { notFound } from 'next/navigation'
import { adminGetObservation } from '@/lib/actions/admin-observation-actions'
import { AdminEditFormClient } from './admin-edit-form-client'
import { DEFAULT_MAX_MEDIA_PER_REPORT } from '@/lib/constants/settings'

export const dynamic = 'force-dynamic'

export default async function AdminEditObservationPage({
  params,
}: {
  params: Promise<{ walkId: string; observationId: string }>
}) {
  const { walkId, observationId } = await params
  const { supabase } = await requireSession()

  // Walk, observation (admin-only, bypasses RLS) and media limit are independent.
  const [{ data: walk }, observation, { data: settings }] = await Promise.all([
    supabase
      .from('walk_slots')
      .select('*, survey_rounds(name)')
      .eq('id', walkId)
      .single(),
    adminGetObservation(observationId),
    supabase
      .from('app_settings')
      .select('max_media_per_report')
      .limit(1)
      .single(),
  ])

  if (!walk) notFound()
  if (!observation || observation.slotId !== walkId) notFound()

  const maxMediaPerReport = settings?.max_media_per_report ?? DEFAULT_MAX_MEDIA_PER_REPORT

  return (
    <AdminEditFormClient
      slot={{
        id: walk.id,
        locationName: walk.location_name,
        walkDate: walk.walk_date,
        startTime: walk.start_time,
        endTime: walk.end_time,
        roundName: walk.survey_rounds.name,
      }}
      observation={observation}
      maxMediaPerReport={maxMediaPerReport}
    />
  )
}
