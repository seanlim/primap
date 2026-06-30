import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { WalksClient } from './walks-client'

export const dynamic = 'force-dynamic'

export default async function WalkPage() {

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get all open rounds with their slots
  const { data: rounds } = await supabase
    .from('survey_rounds')
    .select('*')
    .eq('status', 'OPEN')
    .order('start_date', { ascending: false })

  // Get all slots for open rounds with filters
  const roundIds = (rounds || []).map(r => r.id)

  const { data: slots } = roundIds.length > 0
    ? await supabase
        .from('walk_slots')
        .select('*, slot_memberships(id, user_id, status)', { count: 'exact' })
        .in('round_id', roundIds)
        .order('walk_date', { ascending: true })
    : { data: [] }

  // Get user's active memberships
  const { data: myMemberships } = await supabase
    .from('slot_memberships')
    .select('slot_id')
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')

  return (
    <WalksClient 
      rounds={rounds?.map(r => ({
        id: r.id,
        name: r.name,
        start_date: r.start_date,
        end_date: r.end_date,
        status: r.status,
      })) || []}
      walks={slots?.map(s => ({
        id: s.id,
        round_id: s.round_id,
        location_name: s.location_name,
        walk_date: s.walk_date,
        start_time: s.start_time,
        end_time: s.end_time,
        max_volunteers: s.max_volunteers,
        slot_memberships: s.slot_memberships
      })) || []}
      myMemberships={myMemberships || []}
    />
  )
}
