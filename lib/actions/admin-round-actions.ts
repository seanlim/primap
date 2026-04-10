'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import {
  LATE_CANCEL_HOURS_RANGE,
  MAX_MEDIA_PER_REPORT_RANGE,
  REQUIRED_WALKS_PER_ROUND_RANGE,
} from '@/lib/constants/settings'
import {
  OBSERVATION_MEDIA_BUCKET,
  INCIDENT_MEDIA_BUCKET,
} from '@/lib/utils/storage'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'ADMIN') throw new Error('Not authorized')
  return { supabase, userId: user.id }
}

async function hasSubmittedObservationsForSlots(
  supabase: SupabaseClient<Database>,
  slotIds: string[]
) {
  if (slotIds.length === 0) return { hasSubmitted: false }

  const { data, error } = await supabase
    .from('observations')
    .select('id')
    .in('slot_id', slotIds)
    .eq('status', 'SUBMITTED')
    .limit(1)

  if (error) return { error: error.message }
  return { hasSubmitted: (data?.length ?? 0) > 0 }
}

type ObservationDeleteStatus = 'DRAFT' | 'SUBMITTED'

async function deleteObservationsForSlots(
  supabase: SupabaseClient<Database>,
  slotIds: string[],
  statuses?: ObservationDeleteStatus[]
) {
  if (slotIds.length === 0) return { deletedCount: 0 }

  let observationsQuery = supabase
    .from('observations')
    .select('id')
    .in('slot_id', slotIds)

  if (statuses && statuses.length > 0) {
    observationsQuery = observationsQuery.in('status', statuses)
  }

  const { data: observations, error: observationsError } = await observationsQuery
  if (observationsError) return { error: observationsError.message }

  const observationIds = (observations || []).map((observation) => observation.id)
  if (observationIds.length === 0) return { deletedCount: 0 }

  const { data: sightings, error: sightingsError } = await supabase
    .from('sightings')
    .select('id')
    .in('observation_id', observationIds)

  if (sightingsError) return { error: sightingsError.message }

  const sightingIds = (sightings || []).map((sighting) => sighting.id)
  const [{ data: observationMedia, error: observationMediaError }, { data: sightingMedia, error: sightingMediaError }] = await Promise.all([
    supabase
      .from('media')
      .select('id, file_path')
      .in('observation_id', observationIds),
    sightingIds.length > 0
      ? supabase
          .from('media')
          .select('id, file_path')
          .in('sighting_id', sightingIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (observationMediaError) return { error: observationMediaError.message }
  if (sightingMediaError) return { error: sightingMediaError.message }

  const media = [...(observationMedia || []), ...(sightingMedia || [])]
  const filePaths = media.map((mediaRecord) => mediaRecord.file_path)

  if (filePaths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from(OBSERVATION_MEDIA_BUCKET)
      .remove(filePaths)

    if (storageError) return { error: storageError.message }
  }

  const mediaIds = media.map((mediaRecord) => mediaRecord.id)
  if (mediaIds.length > 0) {
    const { error: mediaDeleteError } = await supabase
      .from('media')
      .delete()
      .in('id', mediaIds)

    if (mediaDeleteError) return { error: mediaDeleteError.message }
  }

  if (sightingIds.length > 0) {
    const { error: sightingDeleteError } = await supabase
      .from('sightings')
      .delete()
      .in('id', sightingIds)

    if (sightingDeleteError) return { error: sightingDeleteError.message }
  }

  const { error: deleteError } = await supabase
    .from('observations')
    .delete()
    .in('id', observationIds)

  if (deleteError) return { error: deleteError.message }
  return { deletedCount: observationIds.length }
}

async function deleteIncidentsForSlots(
  supabase: SupabaseClient<Database>,
  slotIds: string[]
) {
  if (slotIds.length === 0) return { deletedCount: 0 }

  const { data: incidents, error: incidentsError } = await supabase
    .from('incidents')
    .select('id')
    .in('slot_id', slotIds)

  if (incidentsError) return { error: incidentsError.message }

  const incidentIds = (incidents || []).map((incident) => incident.id)
  if (incidentIds.length === 0) return { deletedCount: 0 }

  const { data: media, error: mediaError } = await supabase
    .from('media')
    .select('id, file_path')
    .in('incident_id', incidentIds)

  if (mediaError) return { error: mediaError.message }

  const filePaths = (media || []).map((mediaRecord) => mediaRecord.file_path)
  if (filePaths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from(INCIDENT_MEDIA_BUCKET)
      .remove(filePaths)

    if (storageError) return { error: storageError.message }
  }

  const mediaIds = (media || []).map((mediaRecord) => mediaRecord.id)
  if (mediaIds.length > 0) {
    const { error: mediaDeleteError } = await supabase
      .from('media')
      .delete()
      .in('id', mediaIds)

    if (mediaDeleteError) return { error: mediaDeleteError.message }
  }

  const { error: deleteError } = await supabase
    .from('incidents')
    .delete()
    .in('id', incidentIds)

  if (deleteError) return { error: deleteError.message }
  return { deletedCount: incidentIds.length }
}

export async function createRound(data: {
  name: string
  description?: string
  startDate: string
  endDate: string
}) {
  const errors: string[] = []
  if (!data.name?.trim()) errors.push('Round name is required')
  if (!data.startDate) errors.push('Start date is required')
  if (!data.endDate) errors.push('End date is required')
  if (data.startDate && data.endDate && data.startDate > data.endDate)
    errors.push('Start date must be before end date')
  if (errors.length > 0) return { error: errors.join('; ') }

  const { supabase, userId } = await requireAdmin()

  const { error } = await supabase
    .from('survey_rounds')
    .insert({
      name: data.name,
      description: data.description,
      start_date: data.startDate,
      end_date: data.endDate,
      status: 'DRAFT',
      created_by: userId,
    })

  if (error) return { error: error.message }
  revalidatePath('/admin/rounds')
  return { success: true }
}

export async function updateRound(roundId: string, data: {
  name: string
  description?: string
  startDate: string
  endDate: string
}) {
  const errors: string[] = []
  if (!roundId) errors.push('Round ID is required')
  if (!data.name?.trim()) errors.push('Round name is required')
  if (!data.startDate) errors.push('Start date is required')
  if (!data.endDate) errors.push('End date is required')
  if (data.startDate && data.endDate && data.startDate > data.endDate)
    errors.push('Start date must be before end date')
  if (errors.length > 0) return { error: errors.join('; ') }

  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from('survey_rounds')
    .update({
      name: data.name,
      description: data.description,
      start_date: data.startDate,
      end_date: data.endDate,
    })
    .eq('id', roundId)

  if (error) return { error: error.message }
  revalidatePath('/admin/rounds')
  revalidatePath('/walk')
  return { success: true }
}

export async function updateRoundStatus(roundId: string, status: 'DRAFT' | 'OPEN' | 'CLOSED') {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from('survey_rounds')
    .update({ status })
    .eq('id', roundId)

  if (error) return { error: error.message }
  revalidatePath('/admin/rounds')
  revalidatePath('/walk')
  return { success: true }
}

export async function deleteRound(
  roundId: string,
  options?: { deleteSubmittedReports?: boolean }
) {
  const { supabase } = await requireAdmin()

  const { data: slots, error: slotsError } = await supabase
    .from('walk_slots')
    .select('id')
    .eq('round_id', roundId)

  if (slotsError) return { error: slotsError.message }

  const slotIds = (slots || []).map((slot) => slot.id)
  const submittedCheck = await hasSubmittedObservationsForSlots(supabase, slotIds)
  if (submittedCheck.error) return { error: submittedCheck.error }
  if (submittedCheck.hasSubmitted && !options?.deleteSubmittedReports) {
    return { error: 'This round has submitted reports. Submitted reports must be exported and handled before deleting the round.' }
  }

  const observationCleanup = await deleteObservationsForSlots(
    supabase,
    slotIds,
    options?.deleteSubmittedReports ? undefined : ['DRAFT']
  )
  if (observationCleanup.error) return { error: observationCleanup.error }

  const incidentCleanup = await deleteIncidentsForSlots(supabase, slotIds)
  if (incidentCleanup.error) return { error: incidentCleanup.error }

  if (slotIds.length > 0) {
    const { error: membershipError } = await supabase
      .from('slot_memberships')
      .delete()
      .in('slot_id', slotIds)

    if (membershipError) return { error: membershipError.message }

    const { error: slotsDeleteError } = await supabase
      .from('walk_slots')
      .delete()
      .in('id', slotIds)

    if (slotsDeleteError) return { error: slotsDeleteError.message }
  }

  const { error } = await supabase
    .from('survey_rounds')
    .delete()
    .eq('id', roundId)

  if (error) return { error: error.message }
  revalidatePath('/admin/rounds')
  // Deleting a round removes all of its walks, so the volunteer-facing /walk
  // listing must be invalidated too — otherwise it shows stale entries until
  // the next manual refresh. Matches the pattern used by updateRoundStatus
  // and deleteWalk.
  revalidatePath('/walk')
  return { success: true }
}

function validateWalkData(data: {
  roundId: string
  locationName: string
  walkDate: string
  startTime: string
  endTime: string
  maxVolunteers?: number
}): string[] {
  const errors: string[] = []
  if (!data.roundId) errors.push('Round is required')
  if (!data.locationName?.trim()) errors.push('Location name is required')
  if (!data.walkDate) errors.push('Walk date is required')
  if (!data.startTime) errors.push('Start time is required')
  if (!data.endTime) errors.push('End time is required')
  if (data.startTime && data.endTime && data.startTime >= data.endTime)
    errors.push('Start time must be before end time')
  if (data.maxVolunteers !== undefined && (data.maxVolunteers < 1 || data.maxVolunteers > 10))
    errors.push('Max volunteers must be between 1 and 10')
  return errors
}

async function getRoundDateRange(
  supabase: SupabaseClient<Database>,
  roundId: string
) {
  const { data: round, error } = await supabase
    .from('survey_rounds')
    .select('start_date, end_date')
    .eq('id', roundId)
    .single()

  if (error) return { error: error.message }
  if (!round) return { error: 'Round not found' }
  return { round }
}

function validateWalkDatesInRound(
  walkDates: string[],
  round: { start_date: string; end_date: string }
) {
  const invalidDate = walkDates.find(
    (walkDate) => walkDate < round.start_date || walkDate > round.end_date
  )

  return invalidDate
    ? `Walk date ${invalidDate} must be between the round start date (${round.start_date}) and end date (${round.end_date}).`
    : null
}

export async function createWalk(data: {
  roundId: string
  locationName: string
  walkDate: string
  startTime: string
  endTime: string
  maxVolunteers?: number
  notes?: string
}) {
  const errors = validateWalkData(data)
  if (errors.length > 0) return { error: errors.join('; ') }

  const { supabase } = await requireAdmin()
  const roundDateRange = await getRoundDateRange(supabase, data.roundId)
  if (roundDateRange.error) return { error: roundDateRange.error }

  const rangeError = validateWalkDatesInRound([data.walkDate], roundDateRange.round)
  if (rangeError) return { error: rangeError }

  const { error } = await supabase
    .from('walk_slots')
    .insert({
      round_id: data.roundId,
      location_name: data.locationName,
      walk_date: data.walkDate,
      start_time: data.startTime,
      end_time: data.endTime,
      max_volunteers: data.maxVolunteers || 3,
      notes: data.notes,
    })

  if (error) return { error: error.message }
  revalidatePath('/admin/walks')
  revalidatePath('/walk')
  return { success: true }
}

export async function updateWalk(walkId: string, data: {
  roundId: string
  locationName: string
  walkDate: string
  startTime: string
  endTime: string
  maxVolunteers?: number
  notes?: string
}) {
  if (!walkId) return { error: 'Walk ID is required' }
  const errors = validateWalkData(data)
  if (errors.length > 0) return { error: errors.join('; ') }

  const { supabase } = await requireAdmin()
  const roundDateRange = await getRoundDateRange(supabase, data.roundId)
  if (roundDateRange.error) return { error: roundDateRange.error }

  const rangeError = validateWalkDatesInRound([data.walkDate], roundDateRange.round)
  if (rangeError) return { error: rangeError }

  const { error } = await supabase
    .from('walk_slots')
    .update({
      round_id: data.roundId,
      location_name: data.locationName,
      walk_date: data.walkDate,
      start_time: data.startTime,
      end_time: data.endTime,
      max_volunteers: data.maxVolunteers || 3,
      notes: data.notes,
    })
    .eq('id', walkId)

  if (error) return { error: error.message }
  revalidatePath('/admin/walks')
  revalidatePath('/walk')
  return { success: true }
}

export async function deleteWalk(
  walkId: string,
  options?: { deleteSubmittedReports?: boolean }
) {
  const { supabase } = await requireAdmin()

  const submittedCheck = await hasSubmittedObservationsForSlots(supabase, [walkId])
  if (submittedCheck.error) return { error: submittedCheck.error }
  if (submittedCheck.hasSubmitted && !options?.deleteSubmittedReports) {
    return { error: 'This walk has submitted reports. Submitted reports must be exported and handled before deleting the walk.' }
  }

  const observationCleanup = await deleteObservationsForSlots(
    supabase,
    [walkId],
    options?.deleteSubmittedReports ? undefined : ['DRAFT']
  )
  if (observationCleanup.error) return { error: observationCleanup.error }

  const incidentCleanup = await deleteIncidentsForSlots(supabase, [walkId])
  if (incidentCleanup.error) return { error: incidentCleanup.error }

  const { error: membershipError } = await supabase
    .from('slot_memberships')
    .delete()
    .eq('slot_id', walkId)

  if (membershipError) return { error: membershipError.message }

  const { error } = await supabase
    .from('walk_slots')
    .delete()
    .eq('id', walkId)

  if (error) return { error: error.message }
  revalidatePath('/admin/walks')
  revalidatePath('/walk')
  return { success: true }
}

export async function bulkCreateWalks(data: {
  roundId: string
  slots: {
    locationName: string
    walkDate: string
    startTime: string
    endTime: string
    maxVolunteers?: number
  }[]
}) {
  if (!data.roundId) return { error: 'Round is required' }
  if (!data.slots || data.slots.length === 0) return { error: 'At least one walk is required' }

  for (let i = 0; i < data.slots.length; i++) {
    const errors = validateWalkData({ roundId: data.roundId, ...data.slots[i] })
    if (errors.length > 0) return { error: `Walk ${i + 1}: ${errors.join('; ')}` }
  }

  const { supabase } = await requireAdmin()
  const roundDateRange = await getRoundDateRange(supabase, data.roundId)
  if (roundDateRange.error) return { error: roundDateRange.error }

  const rangeError = validateWalkDatesInRound(
    data.slots.map((slot) => slot.walkDate),
    roundDateRange.round
  )
  if (rangeError) return { error: rangeError }

  const { data: result, error } = await supabase.functions.invoke('bulk-create-walks', {
    body: { roundId: data.roundId, slots: data.slots },
  })

  if (error) return { error: error.message }
  revalidatePath('/admin/walks')
  revalidatePath('/walk')
  return result as { success: true; created: number }
}

export async function updateSettings(data: {
  requiredWalksPerRound: number
  lateCancelHours: number
  maxMediaPerReport: number
}) {
  const errors: string[] = []
  const inRange = (n: number, min: number, max: number) =>
    Number.isInteger(n) && n >= min && n <= max
  if (!inRange(data.requiredWalksPerRound, REQUIRED_WALKS_PER_ROUND_RANGE.min, REQUIRED_WALKS_PER_ROUND_RANGE.max)) {
    errors.push(`Required walks per round must be an integer between ${REQUIRED_WALKS_PER_ROUND_RANGE.min} and ${REQUIRED_WALKS_PER_ROUND_RANGE.max}`)
  }
  if (!inRange(data.lateCancelHours, LATE_CANCEL_HOURS_RANGE.min, LATE_CANCEL_HOURS_RANGE.max)) {
    errors.push(`Late cancellation window must be an integer between ${LATE_CANCEL_HOURS_RANGE.min} and ${LATE_CANCEL_HOURS_RANGE.max} hours`)
  }
  if (!inRange(data.maxMediaPerReport, MAX_MEDIA_PER_REPORT_RANGE.min, MAX_MEDIA_PER_REPORT_RANGE.max)) {
    errors.push(`Max media per report must be an integer between ${MAX_MEDIA_PER_REPORT_RANGE.min} and ${MAX_MEDIA_PER_REPORT_RANGE.max}`)
  }
  if (errors.length > 0) return { error: errors.join('; ') }

  const { supabase } = await requireAdmin()

  const { data: existing } = await supabase
    .from('app_settings')
    .select('id')
    .limit(1)
    .single()

  if (!existing) return { error: 'Settings not found' }

  const { error } = await supabase
    .from('app_settings')
    .update({
      required_walks_per_round: data.requiredWalksPerRound,
      late_cancel_hours: data.lateCancelHours,
      max_media_per_report: data.maxMediaPerReport,
    })
    .eq('id', existing.id)

  if (error) return { error: error.message }
  revalidatePath('/admin/settings')
  return { success: true }
}

export async function resolveIncident(incidentId: string, notes: string) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from('incidents')
    .update({ resolved: true, resolved_notes: notes })
    .eq('id', incidentId)

  if (error) return { error: error.message }
  revalidatePath('/admin/incidents')
  return { success: true }
}
