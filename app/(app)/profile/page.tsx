import { redirect } from 'next/navigation'
import { ProfileClient } from './profile-client'
import { requireSession } from '@/lib/supabase/session'
import type { Tables } from '@/lib/types/database'
import type { AttendanceStatus, HistoryObservation, WalkRef } from '@/lib/types/supabase-helpers'
import { buildSlotPopupMeta } from '@/lib/utils/report-map'

export const dynamic = 'force-dynamic'

type ProfileRow = Tables<'profiles'>

type SubmittedObservation = {
  id: string
  slot_id: string
  status: string
  outcome: string
  lat: number | null
  lng: number | null
  walk_slots: WalkRef | null
}

type WalkHistoryEntry = {
  membership_id: string
  slot_id: string
  history_type: 'active' | 'submitted'
  walk_slots: WalkRef | null
}

type ProfilePagePayload = {
  profile: ProfileRow | null
  submitted_observations: SubmittedObservation[]
  walk_history: WalkHistoryEntry[]
  history_observations: HistoryObservation[]
  attendance: Array<{ slot_id: string; status: AttendanceStatus }>
  sightings: Array<{
    observation_id: string
    lat: number | null
    lng: number | null
    species: string
    species_other: string | null
  }>
  settings: { required_walks_per_round: number } | null
  stats: {
    drafts_pending: number
    reports_submitted: number
    walks_attended: number
  }
}

export default async function ProfilePage() {
  const { supabase } = await requireSession()

  // One query instead of ten sequential PostgREST round trips (see
  // supabase/migrations/20261119120000_add_profile_page_rpc.sql).
  const { data, error } = await supabase.rpc('get_profile_page')

  if (error) {
    console.error('Failed to load profile page data:', error.message)
    redirect('/login?error=profile_fetch_failed')
  }

  const payload = data as unknown as ProfilePagePayload
  const profile = payload.profile
  if (!profile) redirect('/login')

  const submittedObservations = payload.submitted_observations || []
  const walkHistoryItems = payload.walk_history || []

  const obsMap = new Map<string, HistoryObservation>(
    (payload.history_observations || []).map((observation) => [observation.slot_id, observation])
  )

  const attendanceBySlotId = new Map(
    (payload.attendance || []).map((row) => [row.slot_id, row.status])
  )

  const submittedObservationById = new Map(
    submittedObservations.map((observation) => [observation.id, observation])
  )

  const sightingCountByObservationId = new Map<string, number>()
  const reportMapPoints = (payload.sightings || []).flatMap((sighting) => {
    if (!sighting.observation_id) return []
    sightingCountByObservationId.set(
      sighting.observation_id,
      (sightingCountByObservationId.get(sighting.observation_id) ?? 0) + 1
    )

    if (sighting.lat === null || sighting.lng === null) return []

    const observation = submittedObservationById.get(sighting.observation_id)
    const slot = observation?.walk_slots ?? undefined

    return [{
      lat: sighting.lat,
      lng: sighting.lng,
      outcome: 'SIGHTED' as const,
      species: sighting.species,
      speciesOther: sighting.species_other,
      label: sighting.species === 'OTHER'
        ? (sighting.species_other?.trim() || 'Other')
        : sighting.species,
      popupMeta: buildSlotPopupMeta(
        {
          location_name: slot?.location_name || 'My sighting',
          walk_date: slot?.walk_date,
          start_time: slot?.start_time,
        },
        slot?.survey_rounds?.name || null
      ),
    }]
  })

  const notSightedPoints = submittedObservations
    .filter((observation) => observation.outcome === 'NOT_SIGHTED' && observation.lat !== null && observation.lng !== null)
    .map((observation) => {
      const slot = observation.walk_slots ?? undefined
      return {
        lat: observation.lat as number,
        lng: observation.lng as number,
        outcome: 'NOT_SIGHTED' as const,
        label: slot?.location_name || 'No sighting report',
        popupMeta: buildSlotPopupMeta(
          {
            location_name: slot?.location_name || 'No sighting report',
            walk_date: slot?.walk_date,
            start_time: slot?.start_time,
          },
          slot?.survey_rounds?.name || null
        ),
      }
    })

  const stats = payload.stats || { drafts_pending: 0, reports_submitted: 0, walks_attended: 0 }
  const draftsPending = stats.drafts_pending || 0
  const reportsSubmitted = stats.reports_submitted || 0

  return (
    <ProfileClient
      profile={{
        id: profile.id,
        email: profile.email,
        fullName: profile.full_name,
        avatarUrl: profile.avatar_url,
        phoneNumber: profile.phone_number,
        phoneVerifiedAt: profile.phone_verified_at,
        birthMonth: profile.birth_month,
        role: profile.role,
        status: profile.status,
        createdAt: profile.created_at,
      }}
      stats={{
        walksJoined: draftsPending + reportsSubmitted,
        walksAttended: stats.walks_attended || 0,
        reportsSubmitted,
        draftsPending,
        requiredWalks: payload.settings?.required_walks_per_round || 4,
      }}
      reportMapPoints={[...reportMapPoints, ...notSightedPoints]}
      walkHistory={walkHistoryItems.map((entry) => {
        const slot = entry.walk_slots
        const obs = slot?.id ? obsMap.get(slot.id) : undefined
        return {
          membershipId: entry.membership_id,
          slotId: slot?.id || '',
          locationName: slot?.location_name || '',
          walkDate: slot?.walk_date || '',
          startTime: slot?.start_time || '',
          roundName: slot?.survey_rounds?.name || '',
          reportStatus: !obs ? 'none' : obs.status as string,
          attendance: (slot?.id ? attendanceBySlotId.get(slot.id) : undefined) ?? null,
          sightingCount: obs?.outcome === 'SIGHTED' && obs.id ? (sightingCountByObservationId.get(obs.id) || 0) : 0,
        }
      })}
    />
  )
}
