import { createClient } from '@/lib/supabase/server'
import { SlotsClient } from './slots-client'
import type { SlotWithCount } from '@/lib/types/supabase-helpers'

export const dynamic = 'force-dynamic'

export default async function AdminSlotsPage() {
  const supabase = await createClient()

  const { data: slots } = await supabase
    .from('walk_slots')
    .select('*, survey_rounds(name, status), slot_memberships(count)')
    .order('walk_date', { ascending: false })

  const { data: rounds } = await supabase
    .from('survey_rounds')
    .select('id, name')
    .in('status', ['DRAFT', 'OPEN'])
    .order('start_date', { ascending: false })

  const typed = (slots || []) as unknown as SlotWithCount[]

  return (
    <SlotsClient
      slots={typed.map(s => ({
        id: s.id,
        roundId: s.round_id,
        roundName: s.survey_rounds?.name || '',
        locationName: s.location_name,
        walkDate: s.walk_date,
        startTime: s.start_time,
        endTime: s.end_time,
        maxVolunteers: s.max_volunteers,
        memberCount: s.slot_memberships?.length || 0,
      }))}
      rounds={(rounds || []).map(r => ({ id: r.id, name: r.name }))}
    />
  )
}
