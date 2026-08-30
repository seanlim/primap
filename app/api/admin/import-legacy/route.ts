import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { validateLegacyWorkbook } from '@/lib/export-import/import-validators'

export const maxDuration = 300

export async function POST(request: NextRequest) {
  // Auth: verify admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const adminClient = createAdminClient()

    // Validate all rows first
    const { rows, errors } = await validateLegacyWorkbook(buffer, adminClient)

    if (errors.length > 0) {
      return NextResponse.json({ error: 'Validation failed', errors }, { status: 400 })
    }

    // Pre-fetch lookups
    const { data: allRounds } = await adminClient
      .from('survey_rounds')
      .select('id, name')
      .order('id')
      .limit(10000)

    const roundsByName = new Map(
      (allRounds ?? []).map(r => [r.name as string, r.id as string])
    )

    const { data: allProfiles } = await adminClient
      .from('profiles')
      .select('id, email')
      .order('id')
      .limit(10000)

    const profilesByEmail = new Map(
      (allProfiles ?? []).map(p => [(p.email as string).toLowerCase(), p.id as string])
    )

    // Track created walk slots to avoid duplicates
    const walkSlotCache = new Map<string, string>()

    const summary = {
      rows_processed: rows.length,
      observations_created: 0,
      sightings_created: 0,
      walk_slots_created: 0,
      slot_memberships_created: 0,
    }

    for (const row of rows) {
      const roundName = String(row.round_name).trim()
      const roundId = roundsByName.get(roundName)
      if (!roundId) continue

      const email = String(row.observer_email).toLowerCase().trim()
      const userId = profilesByEmail.get(email)
      if (!userId) continue

      const locationName = String(row.location_name).trim()
      const walkDate = normalizeDate(row.walk_date)
      const startTime = String(row.start_time).trim()
      const endTime = String(row.end_time).trim()

      // Look up or create walk slot
      const slotKey = `${roundId}|${locationName}|${walkDate}|${startTime}|${endTime}`
      let slotId = walkSlotCache.get(slotKey)

      if (!slotId) {
        // Check DB first
        const { data: existingSlot } = await adminClient
          .from('walk_slots')
          .select('id')
          .eq('round_id', roundId)
          .eq('location_name', locationName)
          .eq('walk_date', walkDate)
          .eq('start_time', startTime)
          .eq('end_time', endTime)
          .maybeSingle()

        if (existingSlot) {
          slotId = existingSlot.id
        } else {
          const { data: newSlot, error: slotError } = await adminClient
            .from('walk_slots')
            .insert({
              round_id: roundId,
              location_name: locationName,
              walk_date: walkDate,
              start_time: startTime,
              end_time: endTime,
            })
            .select('id')
            .single()

          if (slotError || !newSlot) continue
          slotId = newSlot.id
          summary.walk_slots_created++
        }

        walkSlotCache.set(slotKey, slotId)
      }

      // Create slot membership if not existing
      const { data: existingMembership } = await adminClient
        .from('slot_memberships')
        .select('id')
        .eq('slot_id', slotId)
        .eq('user_id', userId)
        .maybeSingle()

      if (!existingMembership) {
        const { error: memberError } = await adminClient
          .from('slot_memberships')
          .insert({
            slot_id: slotId,
            user_id: userId,
            status: 'ACTIVE',
          })

        if (!memberError) summary.slot_memberships_created++
      }

      // Create observation
      const outcome = String(row.outcome).toUpperCase()
      const walkCompletion = String(row.walk_completion).toUpperCase()

      const obsLat = row.observation_lat !== null && row.observation_lat !== undefined
        ? Number(row.observation_lat) : null
      const obsLng = row.observation_lng !== null && row.observation_lng !== undefined
        ? Number(row.observation_lng) : null

      const { data: observation, error: obsError } = await adminClient
        .from('observations')
        .insert({
          slot_id: slotId,
          status: 'SUBMITTED',
          outcome: outcome as 'SIGHTED' | 'NOT_SIGHTED',
          walk_completion: walkCompletion as 'COMPLETED' | 'PARTIAL' | 'ABORTED',
          lat: obsLat,
          lng: obsLng,
          notes: row.observation_notes ? String(row.observation_notes) : null,
          submitted_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (obsError || !observation) continue
      summary.observations_created++

      // Create sighting if SIGHTED
      if (outcome === 'SIGHTED' && row.species) {
        const species = String(row.species).toUpperCase()
        const sightLat = row.sighting_lat !== null && row.sighting_lat !== undefined && row.sighting_lat !== ''
          ? Number(row.sighting_lat) : obsLat
        const sightLng = row.sighting_lng !== null && row.sighting_lng !== undefined && row.sighting_lng !== ''
          ? Number(row.sighting_lng) : obsLng

        // Skip sighting if no coordinates available (should be caught by validation)
        if (sightLat === null || sightLng === null) continue

        const { error: sightError } = await adminClient
          .from('sightings')
          .insert({
            observation_id: observation.id,
            species: species as 'RBL' | 'LTM' | 'DUSKY',
            count: row.count ? String(row.count) : '1',
            lat: sightLat,
            lng: sightLng,
            observed_at: row.observed_at ? String(row.observed_at) : null,
            notes: row.sighting_notes ? String(row.sighting_notes) : null,
          })

        if (!sightError) summary.sightings_created++
      }
    }

    return NextResponse.json({ success: true, summary })
  } catch (err) {
    console.error('Legacy import failed:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Import failed' },
      { status: 500 }
    )
  }
}

function normalizeDate(value: unknown): string {
  if (!value) return ''
  const str = String(value).trim()
  // If it's already YYYY-MM-DD, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str
  // Try parsing as a date
  const date = new Date(str)
  if (!isNaN(date.getTime())) {
    return date.toISOString().slice(0, 10)
  }
  return str
}
