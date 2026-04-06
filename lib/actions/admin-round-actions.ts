'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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

export async function deleteRound(roundId: string) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from('survey_rounds')
    .delete()
    .eq('id', roundId)

  if (error) return { error: error.message }
  revalidatePath('/admin/rounds')
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

export async function deleteWalk(walkId: string) {
  const { supabase } = await requireAdmin()

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
