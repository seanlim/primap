import { createClient } from '@/lib/supabase/server'
import { RoundsClient } from './rounds-client'
import type { RoundWithCount } from '@/lib/types/supabase-helpers'

export const dynamic = 'force-dynamic'

export default async function AdminRoundsPage() {
  const supabase = await createClient()

  const { data: rounds } = await supabase
    .from('survey_rounds')
    .select('*, walk_slots(count)')
    .order('start_date', { ascending: false })

  const typed = (rounds || []) as unknown as RoundWithCount[]

  return (
    <RoundsClient
      rounds={typed.map(r => ({
        id: r.id,
        name: r.name,
        description: r.description,
        startDate: r.start_date,
        endDate: r.end_date,
        status: r.status,
        slotCount: r.walk_slots?.length || 0,
      }))}
    />
  )
}
