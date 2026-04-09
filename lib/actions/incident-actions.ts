'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendIncidentReportedEmail } from '@/lib/email'
import { INCIDENT_TYPE_LABELS, type IncidentType } from '@/lib/constants/incident-types'

interface ReportIncidentInput {
  walkId: string
  incidentType: IncidentType
  description: string
  lat?: number
  lng?: number
}

export async function reportIncident(
  input: ReportIncidentInput
): Promise<{ success: true; incidentId: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Fail-closed: only active slot participants may report incidents.
  // Use .maybeSingle() so a missing row (non-participant) is `data: null`,
  // not an error. Any error or missing row → reject.
  const { data: membership, error: membershipError } = await supabase
    .from('slot_memberships')
    .select('id')
    .eq('slot_id', input.walkId)
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')
    .maybeSingle()

  if (membershipError) return { error: membershipError.message }
  if (!membership) {
    return { error: 'Only walk participants can report incidents for this walk' }
  }

  const { data: inserted, error } = await supabase
    .from('incidents')
    .insert({
      slot_id: input.walkId,
      reported_by: user.id,
      incident_type: input.incidentType,
      description: input.description,
      lat: input.lat,
      lng: input.lng,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  if (!inserted?.id) return { error: 'Failed to create incident' }

  const incidentId = inserted.id as string

  // Notify admins (best-effort: never fail the user's submission on email errors)
  try {
    const [reporterResult, walkResult, adminsResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', user.id)
        .single(),
      supabase
        .from('walk_slots')
        .select('location_name, walk_date')
        .eq('id', input.walkId)
        .single(),
      supabase
        .from('profiles')
        .select('email')
        .eq('role', 'ADMIN')
        .eq('status', 'ACTIVE'),
    ])

    const reporterName =
      reporterResult.data?.full_name ||
      reporterResult.data?.email ||
      'A volunteer'
    const walkLocation = walkResult.data?.location_name || 'Unknown location'
    const walkDate = walkResult.data?.walk_date || ''
    const adminEmails = (adminsResult.data || [])
      .map(a => a.email)
      .filter((e): e is string => Boolean(e))

    if (adminEmails.length > 0) {
      await sendIncidentReportedEmail(adminEmails, {
        typeLabel: INCIDENT_TYPE_LABELS[input.incidentType] ?? input.incidentType,
        description: input.description,
        reporterName,
        walkLocation,
        walkDate,
      })
    }
  } catch (notifyError) {
    console.error('Failed to send incident notification email:', notifyError)
  }

  revalidatePath(`/report/${input.walkId}`)
  revalidatePath('/admin/incidents')
  return { success: true, incidentId }
}
