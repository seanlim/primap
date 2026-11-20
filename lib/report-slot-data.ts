import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import { hasWalkStarted } from '@/lib/utils/walk-participation'
import { isMinorAtRoundStart } from '@/lib/utils/minor-status'

interface SightingData {
  id: string
  species: string
  speciesOther: string | null
  count: string
  observedAt: string | null
  lat: number
  lng: number
  notes: string | null
  media: { id: string; file_path: string; file_name: string; media_type: string }[]
}

interface ObservationData {
  id: string
  userId: string
  userName: string
  walkCompletion: string | null
  completionComment: string | null
  outcome: string | null
  notes: string | null
  lat: number | null
  lng: number | null
  status: string
  submittedAt: string | null
  sightings: SightingData[]
  media: { id: string; file_path: string; file_name: string; media_type: string }[]
}

interface SlotData {
  id: string
  locationName: string
  walkDate: string
  startTime: string
  endTime: string
  roundName: string
}

interface IncidentMediaItem {
  id: string
  file_path: string
  file_name: string
  media_type: string
}

interface IncidentData {
  id: string
  type: string
  description: string
  reportedBy: string
  createdAt: string
  resolved: boolean
  media: IncidentMediaItem[]
}

export interface MemberData {
  userId: string
  fullName: string | null
  email: string
  attendance: 'PRESENT' | 'ABSENT' | null
  attendanceMarkedAt: string | null
  requiresGuardian: boolean
  guardianPresent: boolean | null
}

interface MemberRow {
  user_id: string
  profiles: { full_name: string | null; email: string; birth_month: string | null } | null
}

interface AttendanceRow {
  user_id: string
  status: 'PRESENT' | 'ABSENT'
  marked_at: string | null
  guardian_present: boolean | null
}

export interface SlotReportViewData {
  slot: SlotData
  observations: ObservationData
  members: MemberData[]
  incidents: IncidentData[]
  isParticipant: boolean
  isAdmin: boolean
  canMarkAttendance: boolean
  hasSubmittedOwnObservation: boolean
}

export interface SlotMembersWithAttendance {
  members: MemberData[]
  isParticipant: boolean
  isAdmin: boolean
}

function mergeMembers(
  members: MemberRow[],
  attendance: AttendanceRow[] | null,
  roundStartDate: string
): MemberData[] {
  const attendanceByUserId = new Map(
    (attendance ?? []).map(row => [row.user_id, row])
  )

  return members.map(member => {
    const recorded = attendanceByUserId.get(member.user_id)
    return {
      userId: member.user_id,
      fullName: member.profiles?.full_name ?? null,
      email: member.profiles?.email ?? '',
      attendance: recorded?.status ?? null,
      attendanceMarkedAt: recorded?.marked_at ?? null,
      requiresGuardian: isMinorAtRoundStart(member.profiles?.birth_month, roundStartDate),
      guardianPresent: recorded?.guardian_present ?? null,
    }
  })
}

/**
 * Load the active volunteers in a slot together with their recorded attendance.
 * Shared by the report view and the draft editor so both render the same list.
 */
export async function getSlotMembersWithAttendance(
  supabase: SupabaseClient<Database>,
  slotId: string,
  currentUserId: string
): Promise<SlotMembersWithAttendance> {
  const [membersResult, attendanceResult, profileResult, slotResult] = await Promise.all([
    supabase
      .from('slot_memberships')
      .select('user_id, profiles:user_id(full_name, email, birth_month)')
      .eq('slot_id', slotId)
      .eq('status', 'ACTIVE'),
    supabase
      .from('slot_attendance')
      .select('user_id, status, marked_at, guardian_present')
      .eq('slot_id', slotId),
    supabase
      .from('profiles')
      .select('role')
      .eq('id', currentUserId)
      .single(),
    supabase
      .from('walk_slots')
      .select('survey_rounds(start_date)')
      .eq('id', slotId)
      .single(),
  ])

  const round = slotResult.data?.survey_rounds as unknown as { start_date: string } | null

  const members = mergeMembers(
    (membersResult.data ?? []) as unknown as MemberRow[],
    attendanceResult.data as AttendanceRow[] | null,
    round?.start_date ?? ''
  )
  const isParticipant = members.some(member => member.userId === currentUserId)
  const isAdmin = profileResult.data?.role === 'ADMIN'

  return {
    members,
    isParticipant,
    isAdmin,
  }
}

export async function getSlotReportViewData(
  supabase: SupabaseClient<Database>,
  slotId: string,
  currentUserId: string
): Promise<SlotReportViewData | null> {
  const [slotResult, observationsResult, membersResult, attendanceResult, profileResult, incidentsResult] = await Promise.all([
    supabase
      .from('walk_slots')
    .select('*, survey_rounds(name, start_date)')
      .eq('id', slotId)
      .single(),
    supabase
      .from('observations')
      .select(`
        *,
        sightings (*, media:media!media_sighting_id_fkey(*)),
        media:media!media_observation_id_fkey(*)
      `)
      .eq('slot_id', slotId)
      .order('created_at', { ascending: true }),
    supabase
      .from('slot_memberships')
      .select('user_id, profiles:user_id(full_name, email, birth_month)')
      .eq('slot_id', slotId)
      .eq('status', 'ACTIVE'),
    supabase
      .from('slot_attendance')
      .select('user_id, status, marked_at, guardian_present')
      .eq('slot_id', slotId),
    supabase
      .from('profiles')
      .select('role')
      .eq('id', currentUserId)
      .single(),
    supabase
      .from('incidents')
      // Narrow to exactly the columns the volunteer/admin views need.
      // Notably excludes `resolved_notes` (admin-only) and lat/lng/updated_at
      // (unused by these views) so we don't ship them over the wire.
      .select(`
        id,
        incident_type,
        description,
        resolved,
        created_at,
        profiles:reported_by(full_name, email),
        media:media!media_incident_id_fkey(id, file_path, file_name, media_type)
      `)
      .eq('slot_id', slotId)
      .order('created_at', { ascending: false }),
  ])

  const slot = slotResult.data
  if (!slot) return null

  const observations = observationsResult.data
  const members = (membersResult.data ?? []) as unknown as MemberRow[]
  const attendance = attendanceResult.data as AttendanceRow[] | null
  const incidents = incidentsResult.data
  const round = slot.survey_rounds as unknown as { name: string; start_date: string }
  const activeMemberIds = new Set(members.map((member) => member.user_id))
  const isParticipant = activeMemberIds.has(currentUserId)
  const isAdmin = profileResult.data?.role === 'ADMIN'
  const visibleObservations = (observations || []).filter(
    (observation) => observation.status === 'SUBMITTED' || isParticipant
  )
  const hasSubmittedOwnObservation = isParticipant && visibleObservations.some(
    obs => obs.status === 'SUBMITTED'
  )

  return {
    slot: {
      id: slot.id,
      locationName: slot.location_name,
      walkDate: slot.walk_date,
      startTime: slot.start_time,
      endTime: slot.end_time,
      roundName: round.name,
    },
    observations: visibleObservations.map(obs => { // TODO: Currently, we select a random primary member, to fix in issue #105
      const primaryMember = members[0]
      return {
      id: obs.id,
      userId: primaryMember?.user_id || '',
      userName: primaryMember?.profiles?.full_name || primaryMember?.profiles?.email || 'Unknown',
      walkCompletion: obs.walk_completion,
      completionComment: obs.completion_comment,
      outcome: obs.outcome,
      notes: obs.notes,
      lat: obs.lat,
      lng: obs.lng,
      status: obs.status,
      submittedAt: obs.submitted_at,
      sightings: obs.sightings.map(s => ({
        id: s.id,
        species: s.species,
        speciesOther: s.species_other,
        count: s.count,
        observedAt: s.observed_at,
        lat: s.lat,
        lng: s.lng,
        notes: s.notes,
        media: s.media,
      })),
      media: obs.media,
    }
    })[0],
    members: mergeMembers(members, attendance, round.start_date),
    incidents: (incidents || []).map(inc => ({
      id: inc.id,
      type: inc.incident_type,
      description: inc.description,
      reportedBy: inc.profiles.full_name || inc.profiles.email,
      createdAt: inc.created_at,
      resolved: inc.resolved,
      media: (inc.media || []).map(m => ({
        id: m.id,
        file_path: m.file_path,
        file_name: m.file_name,
        media_type: m.media_type,
      })),
    })),
    isParticipant,
    isAdmin,
    canMarkAttendance: isAdmin || (isParticipant && hasWalkStarted(slot.walk_date, slot.start_time)),
    hasSubmittedOwnObservation,
  }
}
