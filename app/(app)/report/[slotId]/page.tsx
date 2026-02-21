import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { GroupViewClient } from './group-view-client'

export const dynamic = 'force-dynamic'

export default async function SlotReportPage({
  params,
}: {
  params: Promise<{ slotId: string }>
}) {
  const { slotId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Run all queries in parallel
  const [slotResult, observationsResult, membersResult, incidentsResult] = await Promise.all([
    supabase
      .from('walk_slots')
      .select('*, survey_rounds(name)')
      .eq('id', slotId)
      .single(),
    supabase
      .from('observations')
      .select(`
        *,
        profiles:user_id (full_name, email, avatar_url),
        sightings (*, media:media!media_sighting_id_fkey(*)),
        media:media!media_observation_id_fkey(*)
      `)
      .eq('slot_id', slotId)
      .order('created_at', { ascending: true }),
    supabase
      .from('slot_memberships')
      .select('user_id, profiles:user_id(full_name, email)')
      .eq('slot_id', slotId)
      .eq('status', 'ACTIVE'),
    supabase
      .from('incidents')
      .select('*, profiles:reported_by(full_name, email)')
      .eq('slot_id', slotId)
      .order('created_at', { ascending: false }),
  ])

  const slot = slotResult.data
  if (!slot) notFound()

  const observations = observationsResult.data
  const members = membersResult.data
  const incidents = incidentsResult.data
  const round = slot.survey_rounds as unknown as { name: string }

  return (
    <GroupViewClient
      slot={{
        id: slot.id,
        locationName: slot.location_name,
        walkDate: slot.walk_date,
        startTime: slot.start_time,
        endTime: slot.end_time,
        roundName: round?.name || '',
      }}
      observations={(observations || []).map(obs => ({
        id: obs.id,
        userId: obs.user_id,
        userName: (obs.profiles as unknown as { full_name: string | null; email: string })?.full_name || (obs.profiles as unknown as { email: string })?.email || 'Unknown',
        walkCompletion: obs.walk_completion,
        outcome: obs.outcome,
        notes: obs.notes,
        lat: obs.lat,
        lng: obs.lng,
        status: obs.status,
        submittedAt: obs.submitted_at,
        sightings: ((obs.sightings as unknown as Array<{
          id: string; species: string; count: string;
          observed_at: string | null; lat: number; lng: number; notes: string | null;
          media: Array<{ id: string; file_path: string; file_name: string; media_type: string }>
        }>) || []).map(s => ({
          id: s.id,
          species: s.species,
          count: s.count,
          observedAt: s.observed_at,
          lat: s.lat,
          lng: s.lng,
          notes: s.notes,
          media: s.media || [],
        })),
        media: (obs.media as unknown as Array<{ id: string; file_path: string; file_name: string; media_type: string }>) || [],
      }))}
      members={(members || []).map(m => ({
        userId: m.user_id,
        fullName: (m.profiles as unknown as { full_name: string | null })?.full_name || null,
        email: (m.profiles as unknown as { email: string })?.email || '',
      }))}
      incidents={(incidents || []).map(inc => ({
        id: inc.id,
        type: inc.incident_type,
        description: inc.description,
        reportedBy: (inc.profiles as unknown as { full_name: string | null; email: string })?.full_name || (inc.profiles as unknown as { email: string })?.email || 'Unknown',
        createdAt: inc.created_at,
        resolved: inc.resolved,
      }))}
      currentUserId={user.id}
    />
  )
}
