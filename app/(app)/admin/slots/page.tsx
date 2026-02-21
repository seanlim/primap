import { createClient } from '@/lib/supabase/server'
import { SlotsClient } from './slots-client'

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

  return (
    <SlotsClient
      slots={(slots || []).map(s => ({
        id: s.id,
        roundId: s.round_id,
        roundName: (s.survey_rounds as unknown as { name: string })?.name || '',
        locationName: s.location_name,
        walkDate: s.walk_date,
        startTime: s.start_time,
        endTime: s.end_time,
        maxVolunteers: s.max_volunteers,
        memberCount: (s.slot_memberships as unknown as { count: number }[])?.length || 0,
      }))}
      rounds={(rounds || []).map(r => ({ id: r.id, name: r.name }))}
    />
  )
}
