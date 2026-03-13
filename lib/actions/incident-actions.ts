'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

interface ReportIncidentInput {
  walkId: string
  incidentType: 'INJURED_ANIMAL' | 'DEAD_ANIMAL' | 'HUMAN_WILDLIFE_CONFLICT' | 'HABITAT_DAMAGE' | 'OTHER'
  description: string
  lat?: number
  lng?: number
}

export async function reportIncident(input: ReportIncidentInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('incidents')
    .insert({
      slot_id: input.walkId,
      reported_by: user.id,
      incident_type: input.incidentType,
      description: input.description,
      lat: input.lat,
      lng: input.lng,
    })

  if (error) return { error: error.message }

  revalidatePath(`/report/${input.walkId}`)
  return { success: true }
}
