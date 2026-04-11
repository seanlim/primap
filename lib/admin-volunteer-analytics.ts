import { getWalkStartDateTime, hasWalkEnded } from '@/lib/utils/walk-participation'
import { buildSlotPopupMeta } from '@/lib/utils/report-map'
import { findCurrentRound } from '@/lib/utils/rounds'
import {
  DEFAULT_HIGH_PARTICIPATION_THRESHOLD,
  DEFAULT_LATE_CANCEL_HOURS,
} from '@/lib/constants/settings'
import { getSpeciesShortLabel } from '@/lib/constants/species'

type QueryResult<T> = { data: T | null; error: { message: string } | null }
type CountResult = { count: number | null; error: { message: string } | null }

type SupabaseQueryLike<T> = PromiseLike<QueryResult<T>> & {
  eq: (...args: unknown[]) => SupabaseQueryLike<T>
  order: (...args: unknown[]) => SupabaseQueryLike<T>
  limit: (...args: unknown[]) => SupabaseQueryLike<T>
  in: (...args: unknown[]) => SupabaseQueryLike<T>
}

type SupabaseCountQueryLike = PromiseLike<CountResult> & {
  eq: (...args: unknown[]) => SupabaseCountQueryLike
  order: (...args: unknown[]) => SupabaseCountQueryLike
  limit: (...args: unknown[]) => SupabaseCountQueryLike
  in: (...args: unknown[]) => SupabaseCountQueryLike
}

type SupabaseClientLike = {
  from: (table: string) => {
    select: (...args: unknown[]) => SupabaseQueryLike<unknown> | SupabaseCountQueryLike
  }
}

export interface AnalyticsRound {
  id: string
  name: string
  start_date: string
  end_date: string
  status: 'DRAFT' | 'OPEN' | 'CLOSED'
}

export interface AnalyticsWalkSlot {
  id: string
  round_id: string
  walk_date: string
  start_time: string
  end_time: string
  location_name: string
  max_volunteers: number
}

export interface AnalyticsMembership {
  slot_id: string
  user_id: string
  status: 'ACTIVE' | 'CANCELLED'
}

export interface AnalyticsObservation {
  id?: string
  slot_id: string
  status: 'DRAFT' | 'SUBMITTED'
  outcome?: 'SIGHTED' | 'NOT_SIGHTED'
  lat?: number | null
  lng?: number | null
}

export interface AnalyticsReportMapPoint {
  lat: number
  lng: number
  outcome: 'SIGHTED' | 'NOT_SIGHTED'
  label: string
  popupMeta: string[]
  species?: string
  speciesOther?: string | null
}

export interface AnalyticsAllTimeTotals {
  activeRegisteredVolunteers: number
  totalVolunteerSignUps: number
  totalVolunteerCancellations: number
  totalSubmittedReports: number
}

export interface AnalyticsOverviewMetrics {
  participatingVolunteers: number
  walkSignUps: number
  walkCancellations: number
  submittedReports: number
  reportCompletionRate: number
  completionRateSubmittedReports: number
  completionRateExpectedReports: number
  averageVolunteersPerWalk: number
  capacityFillRate: number
  totalVolunteerCapacity: number
  totalWalks: number
  completedWalks: number
  upcomingWalks: number
  missingReportWalks: number
}

export interface VolunteerAnalyticsLandingSnapshot {
  targetRound: AnalyticsRound | null
  currentRound: AnalyticsOverviewMetrics | null
  reportMapPoints: AnalyticsReportMapPoint[]
}

export interface AdminRoundsAnalyticsPageSnapshot {
  availableRounds: AnalyticsRound[]
  targetRound: AnalyticsRound | null
  overview: AnalyticsOverviewMetrics | null
  reportMapPoints: AnalyticsReportMapPoint[]
}

export interface AdminWalksAnalyticsPageSnapshot {
  availableRounds: AnalyticsRound[]
  targetRound: AnalyticsRound | null
  availableWalks: Array<{
    id: string
    label: string
    roundId: string
    roundName: string
    walkDate: string
    startTime: string
  }>
  targetWalk: AnalyticsWalkSlot | null
  targetWalkRoundName: string | null
  overview: {
    reportCompletionRate: number
    completionRateSubmittedReports: number
    completionRateExpectedReports: number
    capacityFillRate: number
    walkSignUps: number
    totalVolunteerCapacity: number
    cancellations: number
  } | null
  reportMapPoints: AnalyticsReportMapPoint[]
}

export interface AdminUserActivityMetrics {
  participations: number
  submissions: number
  cancellations: number
  lateCancellations: number
  hasLateCancellationIndicator: boolean
  hasHighParticipationIndicator: boolean
}

export interface AdminUsersAnalyticsSnapshot {
  userStats: Record<string, AdminUserActivityMetrics>
}

export interface VolunteerRoundAnalyticsSnapshot {
  availableRounds?: AnalyticsRound[]
  targetRound: AnalyticsRound | null
  currentRound: {
    participatingVolunteers: number
    walkSignUps: number
    walkCancellations: number
    submittedReports: number
    reportCompletionRate: number
    averageVolunteersPerWalk: number
    capacityFillRate: number
  } | null
  roundHealth: {
    totalWalks: number
    completedWalks: number
    upcomingWalks: number
    missingReportWalks: number
  } | null
  allTime: AnalyticsAllTimeTotals | null
}

function buildMetrics(input: {
  slots: AnalyticsWalkSlot[]
  memberships: AnalyticsMembership[]
  observations: AnalyticsObservation[]
  now: Date
}): AnalyticsOverviewMetrics {
  const activeMemberships = input.memberships.filter((membership) => membership.status === 'ACTIVE')
  const cancelledMemberships = input.memberships.filter((membership) => membership.status === 'CANCELLED')
  const submittedObservations = input.observations.filter((observation) => observation.status === 'SUBMITTED')

  const endedSlotIds = new Set(
    input.slots
      .filter((slot) => hasWalkEnded(slot.walk_date, slot.end_time, input.now))
      .map((slot) => slot.id)
  )

  const activeCountBySlot = new Map<string, number>()
  for (const membership of activeMemberships) {
    activeCountBySlot.set(membership.slot_id, (activeCountBySlot.get(membership.slot_id) ?? 0) + 1)
  }

  const submittedCountBySlot = new Map<string, number>()
  for (const observation of submittedObservations) {
    submittedCountBySlot.set(observation.slot_id, (submittedCountBySlot.get(observation.slot_id) ?? 0) + 1)
  }

  const endedActiveMembershipCount = activeMemberships.filter((membership) =>
    endedSlotIds.has(membership.slot_id)
  ).length

  const endedSubmittedReportCount = submittedObservations.filter((observation) =>
    endedSlotIds.has(observation.slot_id)
  ).length

  const totalCapacity = input.slots.reduce((sum, slot) => sum + slot.max_volunteers, 0)
  const missingReportWalks = input.slots.filter((slot) => {
    if (!endedSlotIds.has(slot.id)) return false
    const activeSignUps = activeCountBySlot.get(slot.id) ?? 0
    const submittedReports = submittedCountBySlot.get(slot.id) ?? 0
    return submittedReports < activeSignUps
  }).length

  return {
    participatingVolunteers: new Set(activeMemberships.map((membership) => membership.user_id)).size,
    walkSignUps: activeMemberships.length,
    walkCancellations: cancelledMemberships.length,
    submittedReports: submittedObservations.length,
    reportCompletionRate:
      endedActiveMembershipCount === 0 ? 0 : endedSubmittedReportCount / endedActiveMembershipCount,
    completionRateSubmittedReports: endedSubmittedReportCount,
    completionRateExpectedReports: endedActiveMembershipCount,
    averageVolunteersPerWalk: input.slots.length === 0 ? 0 : activeMemberships.length / input.slots.length,
    capacityFillRate: totalCapacity === 0 ? 0 : activeMemberships.length / totalCapacity,
    totalVolunteerCapacity: totalCapacity,
    totalWalks: input.slots.length,
    completedWalks: endedSlotIds.size,
    upcomingWalks: input.slots.length - endedSlotIds.size,
    missingReportWalks,
  }
}

export function buildVolunteerAnalyticsSnapshot(input: {
  availableRounds?: AnalyticsRound[]
  round: AnalyticsRound
  slots: AnalyticsWalkSlot[]
  memberships: AnalyticsMembership[]
  observations: AnalyticsObservation[]
  allTime: AnalyticsAllTimeTotals
  now?: Date
}): VolunteerRoundAnalyticsSnapshot {
  const metrics = buildMetrics({
    slots: input.slots,
    memberships: input.memberships,
    observations: input.observations,
    now: input.now ?? new Date(),
  })

  return {
    availableRounds: input.availableRounds ?? [input.round],
    targetRound: input.round,
    currentRound: {
      participatingVolunteers: metrics.participatingVolunteers,
      walkSignUps: metrics.walkSignUps,
      walkCancellations: metrics.walkCancellations,
      submittedReports: metrics.submittedReports,
      reportCompletionRate: metrics.reportCompletionRate,
      averageVolunteersPerWalk: metrics.averageVolunteersPerWalk,
      capacityFillRate: metrics.capacityFillRate,
    },
    roundHealth: {
      totalWalks: metrics.totalWalks,
      completedWalks: metrics.completedWalks,
      upcomingWalks: metrics.upcomingWalks,
      missingReportWalks: metrics.missingReportWalks,
    },
    allTime: input.allTime,
  }
}

async function getAnalyticsBaseData(supabase: SupabaseClientLike) {
  const [roundsResult, slotsResult, membershipsResult, observationsResult, activeVolunteersCountResult] = await Promise.all([
    supabase
      .from('survey_rounds')
      .select('id, name, start_date, end_date, status')
      .order('start_date', { ascending: false }) as SupabaseQueryLike<AnalyticsRound[]>,
    supabase
      .from('walk_slots')
      .select('id, round_id, walk_date, start_time, end_time, location_name, max_volunteers')
      .order('walk_date', { ascending: true }) as SupabaseQueryLike<AnalyticsWalkSlot[]>,
    supabase
      .from('slot_memberships')
      .select('slot_id, user_id, status') as SupabaseQueryLike<AnalyticsMembership[]>,
    supabase
      .from('observations')
      .select('id, slot_id, status, outcome, lat, lng') as SupabaseQueryLike<AnalyticsObservation[]>,
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'VOLUNTEER')
      .eq('status', 'ACTIVE') as SupabaseCountQueryLike,
  ])

  return {
    rounds: roundsResult.data ?? [],
    slots: slotsResult.data ?? [],
    memberships: membershipsResult.data ?? [],
    observations: observationsResult.data ?? [],
    activeRegisteredVolunteers: activeVolunteersCountResult.count ?? 0,
  }
}

export async function getAdminWalksAnalyticsPageSnapshotByRound(
  supabase: SupabaseClientLike,
  options?: { roundId?: string | null; walkId?: string | null; now?: Date }
): Promise<AdminWalksAnalyticsPageSnapshot> {
  const base = await getAnalyticsBaseData(supabase)

  if (base.rounds.length === 0 || base.slots.length === 0) {
    return {
      availableRounds: base.rounds,
      targetRound: null,
      availableWalks: [],
      targetWalk: null,
      targetWalkRoundName: null,
      overview: null,
      reportMapPoints: [],
    }
  }

  const targetRound =
    (options?.roundId ? base.rounds.find((round) => round.id === options.roundId) ?? null : null) ??
    base.rounds.find((round) => round.status === 'OPEN') ??
    base.rounds[0]

  const scopedSlots = base.slots.filter((slot) => slot.round_id === targetRound.id)
  const slotsById = new Map(scopedSlots.map((slot) => [slot.id, slot]))
  const targetWalk =
    (options?.walkId ? slotsById.get(options.walkId) ?? null : null) ??
    [...scopedSlots].sort((left, right) => {
      const leftTime = getWalkStartDateTime(left.walk_date, left.start_time).getTime()
      const rightTime = getWalkStartDateTime(right.walk_date, right.start_time).getTime()
      return leftTime - rightTime
    })[0] ??
    null

  if (!targetWalk) {
    return {
      availableRounds: base.rounds,
      targetRound,
      availableWalks: [],
      targetWalk: null,
      targetWalkRoundName: targetRound.name,
      overview: null,
      reportMapPoints: [],
    }
  }

  const targetMemberships = base.memberships.filter((membership) => membership.slot_id === targetWalk.id)
  const targetObservations = base.observations.filter((observation) => observation.slot_id === targetWalk.id)
  const metrics = buildMetrics({
    slots: [targetWalk],
    memberships: targetMemberships,
    observations: targetObservations,
    now: options?.now ?? new Date(),
  })

  const roundNameById = new Map(base.rounds.map((round) => [round.id, round.name]))
  const reportMapPoints = await getReportMapPoints(
    supabase,
    targetObservations,
    new Map([[targetWalk.id, targetWalk]]),
    roundNameById
  )

  return {
    availableRounds: base.rounds,
    targetRound,
    availableWalks: [...scopedSlots]
      .sort((left, right) => {
        const leftTime = getWalkStartDateTime(left.walk_date, left.start_time).getTime()
        const rightTime = getWalkStartDateTime(right.walk_date, right.start_time).getTime()
        return leftTime - rightTime
      })
      .map((slot) => ({
        id: slot.id,
        label: `${slot.location_name} · ${slot.walk_date} · ${slot.start_time.slice(0, 5)}`,
        roundId: slot.round_id,
        roundName: roundNameById.get(slot.round_id) ?? 'Unknown Round',
        walkDate: slot.walk_date,
        startTime: slot.start_time,
      })),
    targetWalk,
    targetWalkRoundName: roundNameById.get(targetWalk.round_id) ?? null,
    overview: {
      reportCompletionRate: metrics.reportCompletionRate,
      completionRateSubmittedReports: metrics.completionRateSubmittedReports,
      completionRateExpectedReports: metrics.completionRateExpectedReports,
      capacityFillRate: metrics.capacityFillRate,
      walkSignUps: metrics.walkSignUps,
      totalVolunteerCapacity: metrics.totalVolunteerCapacity,
      cancellations: metrics.walkCancellations,
    },
    reportMapPoints,
  }
}

async function getReportMapPoints(
  supabase: SupabaseClientLike,
  observations: AnalyticsObservation[],
  slotsById: Map<string, AnalyticsWalkSlot>,
  roundNameById: Map<string, string>
): Promise<AnalyticsReportMapPoint[]> {
  const submittedObservations = observations.filter((observation) => observation.status === 'SUBMITTED')
  const observationIds = submittedObservations
    .map((observation) => observation.id)
    .filter((observationId): observationId is string => Boolean(observationId))

  const sightingsResult: QueryResult<Array<{
    observation_id: string
    lat: number | null
    lng: number | null
    species: string
    species_other: string | null
  }>> = observationIds.length > 0
    ? await (supabase
        .from('sightings')
        .select('observation_id, lat, lng, species, species_other')
        .in('observation_id', observationIds) as SupabaseQueryLike<Array<{
          observation_id: string
          lat: number | null
          lng: number | null
          species: string
          species_other: string | null
        }>>)
    : { data: [], error: null }

  const observationById = new Map(
    submittedObservations
      .filter((observation) => observation.id)
      .map((observation) => [observation.id as string, observation])
  )

  const sightedPointCounts = new Map<string, number>()
  const sightedPoints = (sightingsResult.data ?? [])
    .filter((sighting) => sighting.lat !== null && sighting.lng !== null)
    .map((sighting) => {
      const observation = observationById.get(sighting.observation_id)
      const slot = observation ? slotsById.get(observation.slot_id) : null
      const sequence = (sightedPointCounts.get(sighting.observation_id) ?? 0) + 1
      sightedPointCounts.set(sighting.observation_id, sequence)
      const speciesLabel = getSpeciesShortLabel(sighting.species, sighting.species_other)

        return {
          lat: sighting.lat as number,
          lng: sighting.lng as number,
          outcome: 'SIGHTED' as const,
          label: speciesLabel ?? `Sighting ${sequence}`,
          popupMeta: buildSlotPopupMeta(slot, roundNameById.get(slot?.round_id ?? '') ?? null),
          species: sighting.species,
          speciesOther: sighting.species_other,
        }
      })

  const notSightedPointCounts = new Map<string, number>()
  const notSightedPoints = submittedObservations
    .filter((observation) =>
      observation.outcome === 'NOT_SIGHTED' &&
      observation.lat !== null &&
      observation.lat !== undefined &&
      observation.lng !== null &&
      observation.lng !== undefined
    )
    .map((observation) => {
      const slot = slotsById.get(observation.slot_id)
      const sequence = (notSightedPointCounts.get(observation.slot_id) ?? 0) + 1
      notSightedPointCounts.set(observation.slot_id, sequence)

      return {
        lat: observation.lat as number,
        lng: observation.lng as number,
        outcome: 'NOT_SIGHTED' as const,
        label: `No sighting report ${sequence}`,
        popupMeta: buildSlotPopupMeta(slot, roundNameById.get(slot?.round_id ?? '') ?? null),
      }
    })

  return [...sightedPoints, ...notSightedPoints]
}

export async function getAdminUsersAnalytics(
  supabase: SupabaseClientLike,
  userIds?: string[],
  options?: {
    lateCancelHours?: number
    highParticipationThreshold?: number
  }
): Promise<AdminUsersAnalyticsSnapshot> {
  const profileQuery = supabase.from('profiles').select('id')
  const membershipsQuery = supabase
    .from('slot_memberships')
    .select('user_id, status, cancelled_at, walk_slots(walk_date, start_time)')
  const observationsQuery = supabase.from('observations').select('user_id, status')

  const scopedProfileQuery = userIds?.length ? profileQuery.in('id', userIds) : profileQuery
  const scopedMembershipQuery = userIds?.length ? membershipsQuery.in('user_id', userIds) : membershipsQuery
  const scopedObservationsQuery = userIds?.length ? observationsQuery.in('user_id', userIds) : observationsQuery

  const [profilesResult, membershipsResult, observationsResult] = await Promise.all([
    scopedProfileQuery as SupabaseQueryLike<Array<{ id: string }>>,
    scopedMembershipQuery as SupabaseQueryLike<Array<{
      user_id: string
      status: 'ACTIVE' | 'CANCELLED'
      cancelled_at?: string | null
      walk_slots?: { walk_date?: string | null; start_time?: string | null } | null
    }>>,
    scopedObservationsQuery as SupabaseQueryLike<Array<{ user_id: string; status: 'DRAFT' | 'SUBMITTED' }>>,
  ])

  const validUserIds = new Set((profilesResult.data ?? []).map((profile) => profile.id))
  const userStats = Object.fromEntries(
    Array.from(validUserIds).map((userId) => [
      userId,
      {
        participations: 0,
        submissions: 0,
        cancellations: 0,
        lateCancellations: 0,
        hasLateCancellationIndicator: false,
        hasHighParticipationIndicator: false,
      },
    ])
  ) as Record<string, AdminUserActivityMetrics>
  const lateCancelHours = options?.lateCancelHours ?? DEFAULT_LATE_CANCEL_HOURS
  const highParticipationThreshold =
    options?.highParticipationThreshold ?? DEFAULT_HIGH_PARTICIPATION_THRESHOLD

  for (const membership of membershipsResult.data ?? []) {
    if (!validUserIds.has(membership.user_id)) continue
    if (membership.status === 'ACTIVE') userStats[membership.user_id].participations += 1
    if (membership.status === 'CANCELLED') {
      const stats = userStats[membership.user_id]
      stats.cancellations += 1
      if (isLateCancellation(membership, lateCancelHours)) {
        stats.lateCancellations += 1
        stats.hasLateCancellationIndicator = true
      }
    }
  }

  for (const observation of observationsResult.data ?? []) {
    if (!validUserIds.has(observation.user_id)) continue
    if (observation.status === 'SUBMITTED') userStats[observation.user_id].submissions += 1
  }

  for (const stats of Object.values(userStats)) {
    stats.hasHighParticipationIndicator = stats.participations >= highParticipationThreshold
  }

  return { userStats }
}

function isLateCancellation(
  membership: {
    cancelled_at?: string | null
    walk_slots?: { walk_date?: string | null; start_time?: string | null } | null
  },
  lateCancelHours: number
) {
  const cancelledAt = membership.cancelled_at ? new Date(membership.cancelled_at) : null
  const slot = membership.walk_slots
  if (!cancelledAt || Number.isNaN(cancelledAt.getTime()) || !slot?.walk_date || !slot.start_time) {
    return false
  }

  const walkStart = getWalkStartDateTime(slot.walk_date, slot.start_time)
  if (Number.isNaN(walkStart.getTime())) return false

  const cutoff = new Date(walkStart.getTime() - lateCancelHours * 60 * 60 * 1000)
  return cancelledAt >= cutoff
}

export async function getAdminVolunteerAnalyticsLanding(
  supabase: SupabaseClientLike,
  now = new Date()
): Promise<VolunteerAnalyticsLandingSnapshot> {
  const base = await getAnalyticsBaseData(supabase)

  if (base.rounds.length === 0) {
    return { targetRound: null, currentRound: null, reportMapPoints: [] }
  }

  const targetRound = findCurrentRound(base.rounds, now)

  if (!targetRound) {
    return { targetRound: null, currentRound: null, reportMapPoints: [] }
  }

  const roundNameById = new Map(base.rounds.map((round) => [round.id, round.name]))
  const roundSlots = base.slots.filter((slot) => slot.round_id === targetRound.id)
  const roundSlotIds = new Set(roundSlots.map((slot) => slot.id))
  const roundMemberships = base.memberships.filter((membership) => roundSlotIds.has(membership.slot_id))
  const roundObservations = base.observations.filter((observation) => roundSlotIds.has(observation.slot_id))
  const slotsById = new Map(roundSlots.map((slot) => [slot.id, slot]))

  return {
    targetRound,
    currentRound: buildMetrics({
      slots: roundSlots,
      memberships: roundMemberships,
      observations: roundObservations,
      now,
    }),
    reportMapPoints: await getReportMapPoints(supabase, roundObservations, slotsById, roundNameById),
  }
}

export async function getAdminRoundsAnalyticsPageSnapshot(
  supabase: SupabaseClientLike,
  options?: { roundId?: string | null; now?: Date }
): Promise<AdminRoundsAnalyticsPageSnapshot> {
  const base = await getAnalyticsBaseData(supabase)

  if (base.rounds.length === 0) {
    return {
      availableRounds: [],
      targetRound: null,
      overview: null,
      reportMapPoints: [],
    }
  }

  const targetRound =
    (options?.roundId ? base.rounds.find((round) => round.id === options.roundId) ?? null : null) ??
    base.rounds.find((round) => round.status === 'OPEN') ??
    base.rounds[0]

  const roundSlots = base.slots.filter((slot) => slot.round_id === targetRound.id)
  const roundSlotsById = new Map(roundSlots.map((slot) => [slot.id, slot]))
  const roundNameById = new Map(base.rounds.map((round) => [round.id, round.name]))
  const roundSlotIds = new Set(roundSlots.map((slot) => slot.id))
  const roundMemberships = base.memberships.filter((membership) => roundSlotIds.has(membership.slot_id))
  const roundObservations = base.observations.filter((observation) => roundSlotIds.has(observation.slot_id))

  return {
    availableRounds: base.rounds,
    targetRound,
    overview: buildMetrics({
      slots: roundSlots,
      memberships: roundMemberships,
      observations: roundObservations,
      now: options?.now ?? new Date(),
    }),
    reportMapPoints: await getReportMapPoints(supabase, roundObservations, roundSlotsById, roundNameById),
  }
}
