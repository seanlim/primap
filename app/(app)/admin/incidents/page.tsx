import { createClient } from '@/lib/supabase/server'
import { IncidentsClient } from './incidents-client'

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

  return (
    <IncidentsClient
      incidents={(incidents || []).map(inc => ({
        id: inc.id,
        type: inc.incident_type,
        description: inc.description,
        resolved: inc.resolved,
        resolvedNotes: inc.resolved_notes,
        reportedBy: (inc.profiles as unknown as { full_name: string | null; email: string })?.full_name
          || (inc.profiles as unknown as { email: string })?.email || 'Unknown',
        locationName: (inc.walk_slots as unknown as { location_name: string })?.location_name || '',
        walkDate: (inc.walk_slots as unknown as { walk_date: string })?.walk_date || '',
        createdAt: inc.created_at,
      }))}
    />
  )
}
