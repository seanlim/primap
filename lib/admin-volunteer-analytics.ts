import { hasWalkEnded } from '@/lib/utils/walk-participation'

type QueryResult<T> = { data: T | null; error: { message: string } | null }
type CountResult = { count: number | null; error: { message: string } | null }

type SupabaseClientLike = {
  from: (table: string) => {
    select: (...args: unknown[]) => {
      eq: (...args: unknown[]) => unknown
      order: (...args: unknown[]) => unknown
      limit: (...args: unknown[]) => unknown
      in: (...args: unknown[]) => unknown
      then?: unknown
    }
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
  walk_date: string
  end_time: string
  max_volunteers: number
}

export interface AnalyticsMembership {
  slot_id: string
  user_id: string
  status: 'ACTIVE' | 'CANCELLED'
}

export interface AnalyticsObservation {
  slot_id: string
  status: 'DRAFT' | 'SUBMITTED'
}

export interface AnalyticsAllTimeTotals {
  activeRegisteredVolunteers: number
  totalVolunteerSignUps: number
  totalVolunteerCancellations: number
  totalSubmittedReports: number
}

export interface VolunteerAnalyticsSnapshot {
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

export function buildVolunteerAnalyticsSnapshot(input: {
  round: AnalyticsRound
  slots: AnalyticsWalkSlot[]
  memberships: AnalyticsMembership[]
  observations: AnalyticsObservation[]
  allTime: AnalyticsAllTimeTotals
  now?: Date
}): VolunteerAnalyticsSnapshot {
  const now = input.now ?? new Date()
  const activeMemberships = input.memberships.filter((membership) => membership.status === 'ACTIVE')
  const cancelledMemberships = input.memberships.filter((membership) => membership.status === 'CANCELLED')
  const submittedObservations = input.observations.filter((observation) => observation.status === 'SUBMITTED')
  const endedSlots = input.slots.filter((slot) => hasWalkEnded(slot.walk_date, slot.end_time, now))
  const endedSlotIds = new Set(endedSlots.map((slot) => slot.id))

  const activeMembershipsBySlot = new Map<string, number>()
  for (const membership of activeMemberships) {
    activeMembershipsBySlot.set(
      membership.slot_id,
      (activeMembershipsBySlot.get(membership.slot_id) ?? 0) + 1
    )
  }

  const submittedReportsBySlot = new Map<string, number>()
  for (const observation of submittedObservations) {
    submittedReportsBySlot.set(
      observation.slot_id,
      (submittedReportsBySlot.get(observation.slot_id) ?? 0) + 1
    )
  }

  const endedActiveMembershipCount = activeMemberships.filter((membership) =>
    endedSlotIds.has(membership.slot_id)
  ).length

  const endedSubmittedReportCount = submittedObservations.filter((observation) =>
    endedSlotIds.has(observation.slot_id)
  ).length

  const totalCapacity = input.slots.reduce((sum, slot) => sum + slot.max_volunteers, 0)
  const missingReportWalks = endedSlots.filter((slot) => {
    const activeCount = activeMembershipsBySlot.get(slot.id) ?? 0
    const submittedCount = submittedReportsBySlot.get(slot.id) ?? 0
    return activeCount > submittedCount
  }).length

  return {
    targetRound: input.round,
    currentRound: {
      participatingVolunteers: new Set(activeMemberships.map((membership) => membership.user_id)).size,
      walkSignUps: activeMemberships.length,
      walkCancellations: cancelledMemberships.length,
      submittedReports: submittedObservations.length,
      reportCompletionRate:
        endedActiveMembershipCount === 0 ? 0 : endedSubmittedReportCount / endedActiveMembershipCount,
      averageVolunteersPerWalk: input.slots.length === 0 ? 0 : activeMemberships.length / input.slots.length,
      capacityFillRate: totalCapacity === 0 ? 0 : activeMemberships.length / totalCapacity,
    },
    roundHealth: {
      totalWalks: input.slots.length,
      completedWalks: endedSlots.length,
      upcomingWalks: input.slots.length - endedSlots.length,
      missingReportWalks,
    },
    allTime: input.allTime,
  }
}

export async function getAdminVolunteerAnalytics(
  supabase: SupabaseClientLike,
  now = new Date()
): Promise<VolunteerAnalyticsSnapshot> {
  const openRoundResult = await supabase
    .from('survey_rounds')
    .select('id, name, start_date, end_date, status')
    .eq('status', 'OPEN')
    .order('start_date', { ascending: false })
    .limit(1) as QueryResult<AnalyticsRound[]>

  const openRound = openRoundResult.data?.[0] ?? null

  let targetRound = openRound
  if (!targetRound) {
    const latestRoundResult = await supabase
      .from('survey_rounds')
      .select('id, name, start_date, end_date, status')
      .order('start_date', { ascending: false })
      .limit(1) as QueryResult<AnalyticsRound[]>

    targetRound = latestRoundResult.data?.[0] ?? null
  }

  if (!targetRound) {
    return {
      targetRound: null,
      currentRound: null,
      roundHealth: null,
      allTime: null,
    }
  }

  const slotsResult = await supabase
    .from('walk_slots')
    .select('id, walk_date, end_time, max_volunteers')
    .eq('round_id', targetRound.id)
    .order('walk_date', { ascending: true }) as QueryResult<AnalyticsWalkSlot[]>

  const slots = slotsResult.data ?? []
  const slotIds = slots.map((slot) => slot.id)

  const [membershipsResult, observationsResult] = slotIds.length > 0
    ? await Promise.all([
        supabase
          .from('slot_memberships')
          .select('slot_id, user_id, status')
          .in('slot_id', slotIds) as Promise<QueryResult<AnalyticsMembership[]>>,
        supabase
          .from('observations')
          .select('slot_id, status')
          .eq('status', 'SUBMITTED')
          .in('slot_id', slotIds) as Promise<QueryResult<AnalyticsObservation[]>>,
      ])
    : [
        { data: [], error: null } as QueryResult<AnalyticsMembership[]>,
        { data: [], error: null } as QueryResult<AnalyticsObservation[]>,
      ]

  const [
    activeVolunteersCountResult,
    activeSignUpsCountResult,
    cancellationsCountResult,
    submittedReportsCountResult,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'VOLUNTEER')
      .eq('status', 'ACTIVE') as Promise<CountResult>,
    supabase
      .from('slot_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'ACTIVE') as Promise<CountResult>,
    supabase
      .from('slot_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'CANCELLED') as Promise<CountResult>,
    supabase
      .from('observations')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'SUBMITTED') as Promise<CountResult>,
  ])

  return buildVolunteerAnalyticsSnapshot({
    round: targetRound,
    slots,
    memberships: membershipsResult.data ?? [],
    observations: observationsResult.data ?? [],
    allTime: {
      activeRegisteredVolunteers: activeVolunteersCountResult.count ?? 0,
      totalVolunteerSignUps: activeSignUpsCountResult.count ?? 0,
      totalVolunteerCancellations: cancellationsCountResult.count ?? 0,
      totalSubmittedReports: submittedReportsCountResult.count ?? 0,
    },
    now,
  })
}
