'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

interface ReportIncidentInput {
  slotId: string
  incidentType: 'INJURED_ANIMAL' | 'DEAD_ANIMAL' | 'HUMAN_WILDLIFE_CONFLICT' | 'HABITAT_DAMAGE' | 'OTHER'
  description: string
  lat?: number
  lng?: number
}

export async function reportIncident(input: ReportIncidentInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  
  const { data: membership } = await supabase
    .from('slot_memberships')
    .select('id')
    .eq('slot_id', input.slotId)
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')
    .maybeSingle()

  if (!membership) return { error: 'Only walk participants can report incidents for this walk' }

  const { error } = await supabase
    .from('incidents')
    .insert({
      slot_id: input.slotId,
      reported_by: user.id,
      incident_type: input.incidentType,
      description: input.description,
      lat: input.lat,
      lng: input.lng,
    })

  if (error) return { error: error.message }

  revalidatePath(`/report/${input.slotId}`)
  revalidatePath(`/admin/reports/${input.slotId}`)
  revalidatePath('/admin/reports')
  return { success: true }
}
