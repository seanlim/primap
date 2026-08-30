'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import {
  OBSERVATION_MEDIA_BUCKET,
} from '@/lib/utils/storage'

interface AdminActionResult {
  success?: true
  error?: string
}

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
  return user.id
}

interface SightingInput {
  id?: string
  species: 'RBL' | 'LTM' | 'DUSKY' | 'OTHER'
  species_other?: string
  count: string
  observed_at?: string
  lat: number
  lng: number
  notes?: string
}

interface AdminUpdateObservationInput {
  observationId: string
  walkId: string
  walkCompletion: 'COMPLETED' | 'PARTIAL' | 'ABORTED'
  outcome: 'SIGHTED' | 'NOT_SIGHTED'
  notes?: string
  lat?: number
  lng?: number
  sightings?: SightingInput[]
}

interface ObservationMember {
  userId: string
  userName: string
}

export async function adminGetObservation(observationId: string) {
  await requireAdmin()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('observations')
    .select(`
      *,
      sightings (*, media:media!media_sighting_id_fkey(*)),
      media:media!media_observation_id_fkey(*)
    `)
    .eq('id', observationId)
    .single()

  if (error || !data) return null

  const { data: memberships } = await supabase
    .from('slot_memberships')
    .select('user_id, status, profiles:user_id(full_name, email)')
    .eq('slot_id', data.slot_id)
    .eq('status', 'ACTIVE')

  return {
    id: data.id,
    members: (memberships || []).map<ObservationMember>((member) => ({
      userId: member.user_id,
      userName: member.profiles?.full_name || member.profiles?.email || 'Unknown',
    })),
    slotId: data.slot_id,
    walkCompletion: data.walk_completion,
    outcome: data.outcome,
    notes: data.notes,
    lat: data.lat,
    lng: data.lng,
    status: data.status,
    sightings: data.sightings.map((s) => ({
      id: s.id,
      species: s.species,
      speciesOther: s.species_other,
      count: s.count,
      observedAt: s.observed_at?.slice(0, 16) ?? null,
      lat: s.lat,
      lng: s.lng,
      notes: s.notes,
      media: s.media as { id: string; file_path: string; file_name: string; media_type: string }[],
    })),
    media: data.media as { id: string; file_path: string; file_name: string; media_type: string }[],
  }
}

export async function adminUpdateObservation(
  input: AdminUpdateObservationInput
): Promise<AdminActionResult> {
  await requireAdmin()
  const supabase = createAdminClient()

  // Verify the observation exists
  const { data: existing } = await supabase
    .from('observations')
    .select('id')
    .eq('id', input.observationId)
    .single()

  if (!existing) return { error: 'Observation not found' }

  // Update the observation
  const { error: updateError } = await supabase
    .from('observations')
    .update({
      walk_completion: input.walkCompletion,
      outcome: input.outcome,
      notes: input.notes || null,
      lat: input.outcome === 'NOT_SIGHTED' ? (input.lat ?? null) : null,
      lng: input.outcome === 'NOT_SIGHTED' ? (input.lng ?? null) : null,
    })
    .eq('id', input.observationId)

  if (updateError) return { error: updateError.message }

  // Handle sightings
  if (input.sightings) {
    const keptIds = input.sightings.filter(s => s.id).map(s => s.id)

    // Find sightings to remove
    const { data: existingSightings, error: fetchError } = await supabase
      .from('sightings')
      .select('id')
      .eq('observation_id', input.observationId)

    if (fetchError) return { error: fetchError.message }

    const existingIds = (existingSightings ?? []).map(s => s.id)
    const toRemoveIds = existingIds.filter(id => !keptIds.includes(id))

    // Clean up storage files for removed sightings
    if (toRemoveIds.length > 0) {
      const { data: mediaRecords } = await supabase
        .from('media')
        .select('file_path')
        .in('sighting_id', toRemoveIds)

      if (mediaRecords && mediaRecords.length > 0) {
        await supabase.storage
          .from(OBSERVATION_MEDIA_BUCKET)
          .remove(mediaRecords.map(m => m.file_path))
      }

      const { error: deleteError } = await supabase
        .from('sightings')
        .delete()
        .in('id', toRemoveIds)

      if (deleteError) return { error: deleteError.message }
    }

    // Update existing and insert new sightings
    for (const s of input.sightings) {
      if (s.id) {
        const { error: sightingUpdateError } = await supabase
          .from('sightings')
          .update({
            species: s.species,
            species_other: s.species_other || null,
            count: s.count,
            observed_at: s.observed_at || null,
            lat: s.lat,
            lng: s.lng,
            notes: s.notes || null,
          })
          .eq('id', s.id)

        if (sightingUpdateError) return { error: sightingUpdateError.message }
      } else {
        const { error: sightingInsertError } = await supabase
          .from('sightings')
          .insert({
            observation_id: input.observationId,
            species: s.species,
            species_other: s.species_other || null,
            count: s.count,
            observed_at: s.observed_at || null,
            lat: s.lat,
            lng: s.lng,
            notes: s.notes || null,
          })

        if (sightingInsertError) return { error: sightingInsertError.message }
      }
    }
  } else {
    // No sightings provided — remove all
    const { data: existingSightings, error: fetchError } = await supabase
      .from('sightings')
      .select('id')
      .eq('observation_id', input.observationId)

    if (fetchError) return { error: fetchError.message }

    const existingIds = (existingSightings ?? []).map(s => s.id)
    if (existingIds.length > 0) {
      const { data: mediaRecords } = await supabase
        .from('media')
        .select('file_path')
        .in('sighting_id', existingIds)

      if (mediaRecords && mediaRecords.length > 0) {
        await supabase.storage
          .from(OBSERVATION_MEDIA_BUCKET)
          .remove(mediaRecords.map(m => m.file_path))
      }

      const { error: deleteError } = await supabase
        .from('sightings')
        .delete()
        .in('id', existingIds)

      if (deleteError) return { error: deleteError.message }
    }
  }

  revalidatePath(`/admin/reports/${input.walkId}`)
  revalidatePath(`/report/${input.walkId}`)
  return { success: true }
}

export async function adminDeleteMedia(mediaId: string): Promise<AdminActionResult> {
  await requireAdmin()
  const supabase = createAdminClient()

  const { data: media } = await supabase
    .from('media')
    .select('file_path, observation_id, sighting_id, incident_id')
    .eq('id', mediaId)
    .single()

  if (!media) return { error: 'Media not found' }

  const { error } = await supabase
    .from('media')
    .delete()
    .eq('id', mediaId)

  if (error) return { error: error.message }

  const bucket = media.incident_id ? 'incident-media' : OBSERVATION_MEDIA_BUCKET
  await supabase.storage.from(bucket).remove([media.file_path]).catch(() => {})

  return { success: true }
}
