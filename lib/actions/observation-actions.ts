'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

interface SightingInput {
  id?: string
  species: 'RBL' | 'LTM' | 'DUSKY'
  count: string
  observed_at?: string
  lat: number
  lng: number
  notes?: string
}

interface SaveDraftInput {
  walkId: string
  observationId?: string
  walkCompletion?: 'COMPLETED' | 'PARTIAL' | 'ABORTED'
  outcome?: 'SIGHTED' | 'NOT_SIGHTED'
  notes?: string
  lat?: number
  lng?: number
  clientDraftId?: string
  sightings?: SightingInput[]
}

async function cleanupSightingMedia(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sightingIds: string[]
) {
  if (sightingIds.length === 0) return

  const { data: mediaRecords } = await supabase
    .from('media')
    .select('file_path')
    .in('sighting_id', sightingIds)

  if (mediaRecords && mediaRecords.length > 0) {
    await supabase.storage
      .from('observation-media')
      .remove(mediaRecords.map(m => m.file_path))
  }
}

export async function saveDraft(input: SaveDraftInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Derive outcome from sightings
  const hasSightings = input.sightings && input.sightings.length > 0
  const derivedOutcome = hasSightings ? 'SIGHTED' : (input.outcome || null)

  let observationId = input.observationId

  if (observationId) {
    // Update existing draft
    const { error } = await supabase
      .from('observations')
      .update({
        walk_completion: input.walkCompletion,
        outcome: derivedOutcome,
        notes: input.notes,
        lat: input.lat,
        lng: input.lng,
      })
      .eq('id', observationId)
      .eq('user_id', user.id)
      .eq('status', 'DRAFT')

    if (error) return { error: error.message }
  } else {
    // Create new draft
    const { data, error } = await supabase
      .from('observations')
      .insert({
        slot_id: input.walkId,
        user_id: user.id,
        walk_completion: input.walkCompletion,
        outcome: derivedOutcome,
        notes: input.notes,
        lat: input.lat,
        lng: input.lng,
        status: 'DRAFT',
        client_draft_id: input.clientDraftId,
      })
      .select('id')
      .single()

    if (error) {
      if (error.code === '23505') return { error: 'You already have a report for this walk.' }
      return { error: error.message }
    }
    observationId = data.id
  }

  // Handle sightings via upsert pattern
  const sightingIds: string[] = []

  if (observationId && input.sightings) {
    // Identify which sightings to keep (those with existing IDs)
    const keptIds = input.sightings
      .filter(s => s.id)
      .map(s => s.id!)

    // Find sightings to remove (in DB but not in form)
    const { data: existingSightings } = await supabase
      .from('sightings')
      .select('id')
      .eq('observation_id', observationId)

    const existingIds = (existingSightings || []).map(s => s.id)
    const toRemoveIds = existingIds.filter(id => !keptIds.includes(id))

    // Clean up storage files for removed sightings before cascade delete
    await cleanupSightingMedia(supabase, toRemoveIds)

    // Delete only removed sightings (cascade handles media DB records)
    if (toRemoveIds.length > 0) {
      await supabase
        .from('sightings')
        .delete()
        .in('id', toRemoveIds)
    }

    // Update existing and insert new sightings
    for (const s of input.sightings) {
      if (s.id) {
        // Update existing
        await supabase
          .from('sightings')
          .update({
            species: s.species,
            count: s.count,
            observed_at: s.observed_at || null,
            lat: s.lat,
            lng: s.lng,
            notes: s.notes || null,
          })
          .eq('id', s.id)
        sightingIds.push(s.id)
      } else {
        // Insert new
        const { data: newSighting } = await supabase
          .from('sightings')
          .insert({
            observation_id: observationId!,
            species: s.species,
            count: s.count,
            observed_at: s.observed_at || null,
            lat: s.lat,
            lng: s.lng,
            notes: s.notes || null,
          })
          .select('id')
          .single()
        if (newSighting) sightingIds.push(newSighting.id)
      }
    }
  } else if (observationId && (!input.sightings || input.sightings.length === 0)) {
    // No sightings in form — remove all existing
    const { data: existingSightings } = await supabase
      .from('sightings')
      .select('id')
      .eq('observation_id', observationId)

    const existingIds = (existingSightings || []).map(s => s.id)
    if (existingIds.length > 0) {
      await cleanupSightingMedia(supabase, existingIds)
      await supabase
        .from('sightings')
        .delete()
        .in('id', existingIds)
    }
  }

  revalidatePath('/report')
  revalidatePath(`/report/${input.walkId}`)
  return { success: true, observationId, sightingIds }
}

export async function submitObservation(observationId: string, walkId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Verify the observation belongs to user and is DRAFT
  const { data: obs } = await supabase
    .from('observations')
    .select('*, sightings(*)')
    .eq('id', observationId)
    .eq('user_id', user.id)
    .eq('status', 'DRAFT')
    .single()

  if (!obs) return { error: 'Observation not found or already submitted.' }

  // Validation
  if (!obs.walk_completion) return { error: 'Walk completion is required.' }
  if (!obs.outcome) return { error: 'Outcome is required.' }

  if (obs.outcome === 'SIGHTED') {
    const sightings = obs.sightings as unknown as { lat: number; lng: number }[]
    if (!sightings || sightings.length === 0) {
      return { error: 'At least one sighting is required when outcome is Sighted.' }
    }
    for (const s of sightings) {
      if (!s.lat || !s.lng) {
        return { error: 'GPS location is required for each sighting.' }
      }
    }
  }

  if (obs.outcome === 'NOT_SIGHTED' && (!obs.lat || !obs.lng)) {
    return { error: 'GPS location is required for Not Sighted reports.' }
  }

  const { error } = await supabase
    .from('observations')
    .update({
      status: 'SUBMITTED',
      submitted_at: new Date().toISOString(),
    })
    .eq('id', observationId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/report')
  revalidatePath(`/report/${walkId}`)
  revalidatePath('/home')
  revalidatePath('/profile')
  return { success: true }
}

export async function uploadMedia(
  file: FormData,
  parentType: 'observation' | 'sighting',
  parentId: string,
  exifData?: { lat?: number | null; lng?: number | null; datetime?: string | null }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const uploadedFile = file.get('file') as File
  if (!uploadedFile) return { error: 'No file provided' }

  const fileExt = uploadedFile.name.split('.').pop()
  const filePath = `${user.id}/${parentId}/${crypto.randomUUID()}.${fileExt}`

  const { error: uploadError } = await supabase.storage
    .from('observation-media')
    .upload(filePath, uploadedFile)

  if (uploadError) return { error: uploadError.message }

  const mediaType = uploadedFile.type.startsWith('video/') ? 'VIDEO' : 'PHOTO'

  const { data, error: insertError } = await supabase
    .from('media')
    .insert({
      ...(parentType === 'observation'
        ? { observation_id: parentId }
        : { sighting_id: parentId }),
      file_path: filePath,
      file_name: uploadedFile.name,
      media_type: mediaType,
      file_size: uploadedFile.size,
      exif_lat: exifData?.lat ?? null,
      exif_lng: exifData?.lng ?? null,
      exif_datetime: exifData?.datetime ?? null,
    })
    .select()
    .single()

  if (insertError) return { error: insertError.message }

  return { success: true, media: data }
}

export async function deleteMedia(mediaId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Get the media record to find file path
  const { data: media } = await supabase
    .from('media')
    .select('file_path')
    .eq('id', mediaId)
    .single()

  if (!media) return { error: 'Media not found' }

  // Delete from storage
  await supabase.storage.from('observation-media').remove([media.file_path])

  // Delete from database
  const { error } = await supabase
    .from('media')
    .delete()
    .eq('id', mediaId)

  if (error) return { error: error.message }

  return { success: true }
}
