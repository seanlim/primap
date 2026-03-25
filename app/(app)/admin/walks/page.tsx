import { createClient } from '@/lib/supabase/server'
import { WalksClient } from './walks-client'
import type { WalkWithCount } from '@/lib/types/supabase-helpers'

export const dynamic = 'force-dynamic'

export default async function AdminWalksPage() {
  const supabase = await createClient()

  const { data: walks } = await supabase
    .from('walk_slots')
    .select('*, survey_rounds(name, status), slot_memberships(count)')
    .order('walk_date', { ascending: false })

  const { data: rounds } = await supabase
    .from('survey_rounds')
    .select('id, name')
    .in('status', ['DRAFT', 'OPEN'])
    .order('start_date', { ascending: false })

  const typed = (walks || []) as unknown as WalkWithCount[]

  return (
    <WalksClient
      walks={typed.map(s => ({
        id: s.id,
        roundId: s.round_id,
        roundName: s.survey_rounds?.name || '',
        locationName: s.location_name,
        walkDate: s.walk_date,
        startTime: s.start_time,
        endTime: s.end_time,
        maxVolunteers: s.max_volunteers,
        memberCount: s.slot_memberships[0]?.count,
      }))}
      rounds={(rounds || []).map(r => ({ id: r.id, name: r.name }))}
    />
  )
}
