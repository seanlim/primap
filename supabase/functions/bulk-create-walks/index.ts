import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_VOLUNTEERS_PER_SLOT = 3

interface SlotInput {
  locationName: string
  walkDate: string
  startTime: string
  endTime: string
  maxVolunteers?: number
}

interface BulkCreateRequest {
  roundId: string
  slots: SlotInput[]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create client with user's JWT for auth verification
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const userClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    })

    // Verify the user is authenticated and is an admin
    const { data: { user }, error: authError } = await userClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Use service role client for admin check and inserts
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    const { data: profile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'ADMIN') {
      return new Response(
        JSON.stringify({ error: 'Not authorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body: BulkCreateRequest = await req.json()
    const { roundId, slots } = body

    // Validate round exists and is DRAFT or OPEN
    const { data: round, error: roundError } = await adminClient
      .from('survey_rounds')
      .select('id, status, start_date, end_date')
      .eq('id', roundId)
      .single()

    if (roundError || !round) {
      return new Response(
        JSON.stringify({ error: 'Round not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!['DRAFT', 'OPEN'].includes(round.status)) {
      return new Response(
        JSON.stringify({ error: 'Round must be in DRAFT or OPEN status' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate slots
    if (!slots || slots.length === 0) {
      return new Response(
        JSON.stringify({ error: 'At least one walk is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const invalidSlot = slots.find(
      (slot) => slot.walkDate < round.start_date || slot.walkDate > round.end_date
    )
    if (invalidSlot) {
      return new Response(
        JSON.stringify({
          error: `Walk date ${invalidSlot.walkDate} must be between the round start date (${round.start_date}) and end date (${round.end_date}).`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const invalidCapacitySlot = slots.find((slot) => {
      const maxVolunteers = slot.maxVolunteers ?? MAX_VOLUNTEERS_PER_SLOT
      return !Number.isInteger(maxVolunteers) || maxVolunteers < 1 || maxVolunteers > MAX_VOLUNTEERS_PER_SLOT
    })

    if (invalidCapacitySlot) {
      return new Response(
        JSON.stringify({ error: `Max volunteers must be between 1 and ${MAX_VOLUNTEERS_PER_SLOT}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const rows = slots.map((s) => ({
      round_id: roundId,
      location_name: s.locationName,
      walk_date: s.walkDate,
      start_time: s.startTime,
      end_time: s.endTime,
      max_volunteers: s.maxVolunteers ?? MAX_VOLUNTEERS_PER_SLOT,
    }))

    // Batch insert all walks in a single operation
    const { error: insertError } = await adminClient
      .from('walk_slots')
      .insert(rows)

    if (insertError) {
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, created: rows.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
