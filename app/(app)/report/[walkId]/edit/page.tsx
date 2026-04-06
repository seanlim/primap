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
  const [walkResult, membershipResult, obsResult, settingsResult] = await Promise.all([
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
    supabase
      .from('app_settings')
      .select('max_media_per_report')
      .limit(1)
      .single(),
  ])

  const walk = walkResult.data
  if (!walk) notFound()

  const membership = membershipResult.data
  if (!membership) redirect('/report')

  const existingObs = obsResult.data
  const maxMediaPerReport = settingsResult.data?.max_media_per_report ?? 10

  // Can't edit submitted observations
  if (existingObs?.status === 'SUBMITTED') {
    redirect(`/report/${walkId}`)
  }

  return (
    <ObservationFormClient
      slot={{
        id: walk.id,
        locationName: walk.location_name,
        walkDate: walk.walk_date,
        startTime: walk.start_time,
        endTime: walk.end_time,
        roundName: walk.survey_rounds.name,
      }}
      maxMediaPerReport={maxMediaPerReport}
      existingObservation={existingObs ? {
        id: existingObs.id,
        walkCompletion: existingObs.walk_completion,
        outcome: existingObs.outcome,
        notes: existingObs.notes,
        lat: existingObs.lat,
        lng: existingObs.lng,
        serverUpdatedAt: existingObs.updated_at,
        sightings: existingObs.sightings.map(s => ({
          id: s.id,
          species: s.species,
          count: s.count,
          observedAt: s.observed_at?.slice(0, 16) ?? null,
          lat: s.lat,
          lng: s.lng,
          notes: s.notes,
          media: s.media,
        })),
        media: existingObs.media,
      } : null}
    />
  )
}
