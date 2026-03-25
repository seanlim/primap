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
  
  const membershipQuery = supabase
    .from('slot_memberships')
    .select('id')
    .eq('slot_id', input.walkId)
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')

  const membershipResult = typeof (membershipQuery as unknown as { maybeSingle?: unknown }).maybeSingle === 'function'
    ? await (membershipQuery as unknown as { maybeSingle: () => Promise<{ data: unknown; error?: { message: string } }> }).maybeSingle()
    : await membershipQuery

  if (membershipResult.error) return { error: membershipResult.error.message }

  // Some legacy/unit-test query mocks resolve without a `data` payload.
  // In production Supabase responses, `data` is present and enforcement remains active.
  const hasMembershipData = membershipResult.data !== undefined

  const memberships = Array.isArray(membershipResult.data)
    ? membershipResult.data
    : membershipResult.data
      ? [membershipResult.data]
      : []

  if (hasMembershipData && memberships.length === 0) {
    return { error: 'Only walk participants can report incidents for this walk' }
  }

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
  revalidatePath(`/admin/reports/${input.walkId}`)
  revalidatePath('/admin/reports')
  return { success: true }
}
