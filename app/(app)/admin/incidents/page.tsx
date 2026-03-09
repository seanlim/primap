import { createClient } from '@/lib/supabase/server'
import { IncidentsClient } from './incidents-client'
import type { IncidentWithRelations } from '@/lib/types/supabase-helpers'

export const dynamic = 'force-dynamic'

export default async function AdminIncidentsPage() {
  const supabase = await createClient()

  const { data: incidents } = await supabase
    .from('incidents')
    .select(`
      *,
      profiles:reported_by(full_name, email),
      walk_slots(location_name, walk_date)
    `)
    .order('created_at', { ascending: false })

  const typed = (incidents || []) as unknown as IncidentWithRelations[]

  return (
    <IncidentsClient
      incidents={typed.map(inc => ({
        id: inc.id,
        type: inc.incident_type,
        description: inc.description,
        resolved: inc.resolved,
        resolvedNotes: inc.resolved_notes,
        reportedBy: inc.profiles?.full_name || inc.profiles?.email || 'Unknown',
        locationName: inc.walk_slots?.location_name || '',
        walkDate: inc.walk_slots?.walk_date || '',
        createdAt: inc.created_at,
      }))}
    />
  )
}
