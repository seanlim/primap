import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ProfileClient } from './profile-client'
import type { WalkRef, HistoryObservation } from '@/lib/types/supabase-helpers'
import { hasWalkEnded } from '@/lib/utils/walk-participation'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  // Get stats
  const { count: walksJoined } = await supabase
    .from('slot_memberships')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')

  const { count: reportsSubmitted } = await supabase
    .from('observations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'SUBMITTED')

  const [{ data: activeMemberships }, { data: submittedObservationHistory }] = await Promise.all([
    supabase
      .from('slot_memberships')
      .select(`
        id,
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
      .order('joined_at', { ascending: false })
      .limit(20),
    supabase
      .from('observations')
      .select(`
        id,
        slot_id,
        status,
        outcome,
        lat,
        lng,
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

  const activeWalkHistory = activeMemberships || []
  const activeSlotIds = activeWalkHistory
    .map((membership) => (membership.walk_slots as unknown as WalkRef)?.id)
    .filter(Boolean)

  const { count: draftsPending } = activeSlotIds.length > 0
    ? await supabase
        .from('observations')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'DRAFT')
        .in('slot_id', activeSlotIds)
    : { count: 0 }

  const walkHistoryItems = [
    ...activeWalkHistory.map((membership) => ({
      membershipId: membership.id,
      slot: membership.walk_slots as unknown as WalkRef,
      historyType: 'active' as const,
    })),
    ...(submittedObservationHistory || [])
      .filter((observation) => !activeSlotIds.includes(observation.slot_id))
      .map((observation) => ({
        membershipId: observation.id,
        slot: observation.walk_slots as unknown as WalkRef,
        historyType: 'submitted' as const,
      })),
  ]
    .filter((item) => item.slot && (item.historyType === 'active' || hasWalkEnded(item.slot.walk_date, item.slot.end_time)))
    .sort((a, b) => {
      const aTime = new Date(`${a.slot.walk_date}T${a.slot.start_time}`).getTime()
      const bTime = new Date(`${b.slot.walk_date}T${b.slot.start_time}`).getTime()
      return bTime - aTime
    })
    .slice(0, 20)

  const walkSlotIds = walkHistoryItems
    .map(w => w.slot?.id)
    .filter(Boolean)

  const { data: historyObservations } = walkSlotIds.length > 0
    ? await supabase
        .from('observations')
        .select('id, slot_id, status, outcome, lat, lng')
        .eq('user_id', user.id)
        .in('slot_id', walkSlotIds)
    : { data: [] }

  const obsMap = new Map(
    (historyObservations || []).map(o => [o.slot_id, o as HistoryObservation & { id: string }])
  )

  const submittedObservationIds = (submittedObservationHistory || []).map((observation) => observation.id)
  const { data: submittedSightings } = submittedObservationIds.length > 0
    ? await supabase
        .from('sightings')
        .select('observation_id, lat, lng, species')
        .in('observation_id', submittedObservationIds)
    : { data: [] }

  const sightingCountByObservationId = new Map<string, number>()
  const reportMapPoints = (submittedSightings || []).flatMap((sighting) => {
    if (!sighting.observation_id) return []
    sightingCountByObservationId.set(
      sighting.observation_id,
      (sightingCountByObservationId.get(sighting.observation_id) ?? 0) + 1
    )

    if (sighting.lat === null || sighting.lng === null) return []

    const observation = (submittedObservationHistory || []).find(
      (item) => item.id === sighting.observation_id
    )
    const slot = observation?.walk_slots as unknown as WalkRef | undefined

    return [{
      lat: sighting.lat,
      lng: sighting.lng,
      outcome: 'SIGHTED' as const,
      species: sighting.species,
      label: sighting.species,
      popupMeta: [
        slot?.location_name || 'My sighting',
        slot?.walk_date ? new Date(slot.walk_date).toLocaleDateString('en-SG') : null,
        slot?.survey_rounds?.name || null,
      ].filter(Boolean) as string[],
    }]
  })

  const notSightedPoints = (submittedObservationHistory || [])
    .filter((observation) => observation.outcome === 'NOT_SIGHTED' && observation.lat !== null && observation.lng !== null)
    .map((observation) => {
      const slot = observation.walk_slots as unknown as WalkRef | undefined
      return {
        lat: observation.lat as number,
        lng: observation.lng as number,
        outcome: 'NOT_SIGHTED' as const,
        label: slot?.location_name || 'No sighting report',
        popupMeta: [
          slot?.location_name || 'No sighting report',
          slot?.walk_date ? new Date(slot.walk_date).toLocaleDateString('en-SG') : null,
          slot?.survey_rounds?.name || null,
        ].filter(Boolean),
      }
    })

  // Get app settings for progress
  const { data: settings } = await supabase
    .from('app_settings')
    .select('required_walks_per_round')
    .limit(1)
    .single()

  return (
    <ProfileClient
      profile={{
        id: profile.id,
        email: profile.email,
        fullName: profile.full_name,
        avatarUrl: profile.avatar_url,
        role: profile.role,
        status: profile.status,
        createdAt: profile.created_at,
      }}
      stats={{
        walksJoined: walksJoined || 0,
        reportsSubmitted: reportsSubmitted || 0,
        draftsPending: draftsPending || 0,
        requiredWalks: settings?.required_walks_per_round || 4,
      }}
      reportMapPoints={[...reportMapPoints, ...notSightedPoints]}
      walkHistory={walkHistoryItems.map(w => {
        const slot = w.slot
        const obs = obsMap.get(slot?.id)
        return {
          membershipId: w.membershipId,
          slotId: slot?.id || '',
          locationName: slot?.location_name || '',
          walkDate: slot?.walk_date || '',
          startTime: slot?.start_time || '',
          roundName: slot?.survey_rounds?.name || '',
          reportStatus: !obs ? 'none' : obs.status as string,
          sightingCount: obs?.outcome === 'SIGHTED' && obs.id ? (sightingCountByObservationId.get(obs.id) || 0) : 0,
        }
      })}
    />
  )
}
