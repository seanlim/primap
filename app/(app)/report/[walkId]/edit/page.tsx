import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ObservationFormClient } from './observation-form-client'

export const dynamic = 'force-dynamic'

export default async function EditReportPage({
  params,
}: {
  params: Promise<{ walkId: string }>
}) {
  const { walkId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Run all queries in parallel
  const [walkResult, membershipResult, obsResult] = await Promise.all([
    supabase
      .from('walk_slots')
      .select('*, survey_rounds(name)')
      .eq('id', walkId)
      .single(),
    supabase
      .from('slot_memberships')
      .select('id')
      .eq('slot_id', walkId)
      .eq('user_id', user.id)
      .eq('status', 'ACTIVE')
      .single(),
    supabase
      .from('observations')
      .select('*, sightings(*, media:media!media_sighting_id_fkey(*)), media:media!media_observation_id_fkey(*)')
      .eq('slot_id', walkId)
      .eq('user_id', user.id)
      .single(),
  ])

  const walk = walkResult.data
  if (!walk) notFound()

  const existingObs = obsResult.data

  // Can't edit submitted observations
  if (existingObs?.status === 'SUBMITTED') {
    redirect(`/report/${walkId}`)
  }

  const round = walk.survey_rounds as unknown as { name: string }

  return (
    <ObservationFormClient
      slot={{
        id: walk.id,
        locationName: walk.location_name,
        walkDate: walk.walk_date,
        startTime: walk.start_time,
        endTime: walk.end_time,
        roundName: round?.name || '',
      }}
      existingObservation={existingObs ? {
        id: existingObs.id,
        walkCompletion: existingObs.walk_completion as 'COMPLETED' | 'PARTIAL' | 'ABORTED' | null,
        outcome: existingObs.outcome as 'SIGHTED' | 'NOT_SIGHTED' | null,
        notes: existingObs.notes,
        lat: existingObs.lat,
        lng: existingObs.lng,
        sightings: ((existingObs.sightings as unknown as Array<{
          id: string; species: string; count: string;
          observed_at: string | null; lat: number; lng: number; notes: string | null;
          media: Array<{ id: string; file_path: string; file_name: string; media_type: string }>
        }>) || []).map(s => ({
          id: s.id,
          species: s.species as 'RBL' | 'LTM' | 'DUSKY',
          count: s.count,
          observedAt: s.observed_at,
          lat: s.lat,
          lng: s.lng,
          notes: s.notes,
          media: s.media || [],
        })),
        media: (existingObs.media as unknown as Array<{ id: string; file_path: string; file_name: string; media_type: string }>) || [],
      } : null}
    />
  )
}
