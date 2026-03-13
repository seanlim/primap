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

export async function createWalk(data: {
  roundId: string
  locationName: string
  walkDate: string
  startTime: string
  endTime: string
  maxVolunteers?: number
  notes?: string
}) {
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

export async function updateSettings(data: {
  requiredWalksPerRound: number
  lateCancelHours: number
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
