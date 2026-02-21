import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ProfileClient } from './profile-client'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  // Get stats
  const { count: walksJoined } = await supabase
    .from('slot_memberships')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')

  const { count: reportsSubmitted } = await supabase
    .from('observations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'SUBMITTED')

  const { count: draftsPending } = await supabase
    .from('observations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'DRAFT')

  // Get walk history
  const { data: walkHistory } = await supabase
    .from('slot_memberships')
    .select(`
      id,
      walk_slots (
        id,
        location_name,
        walk_date,
        start_time,
        end_time,
        survey_rounds (name)
      )
    `)
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')
    .order('joined_at', { ascending: false })
    .limit(20)

  // Get observations for walk history items
  const walkSlotIds = (walkHistory || [])
    .map(w => (w.walk_slots as unknown as { id: string })?.id)
    .filter(Boolean)

  const { data: historyObservations } = walkSlotIds.length > 0
    ? await supabase
        .from('observations')
        .select('slot_id, status, outcome, sightings(count)')
        .eq('user_id', user.id)
        .in('slot_id', walkSlotIds)
    : { data: [] }

  const obsMap = new Map(
    (historyObservations || []).map(o => [o.slot_id, o])
  )

  // Get app settings for progress
  const { data: settings } = await supabase
    .from('app_settings')
    .select('required_walks_per_round')
    .limit(1)
    .single()

  return (
    <ProfileClient
      profile={{
        id: profile.id,
        email: profile.email,
        fullName: profile.full_name,
        avatarUrl: profile.avatar_url,
        role: profile.role,
        status: profile.status,
        createdAt: profile.created_at,
      }}
      stats={{
        walksJoined: walksJoined || 0,
        reportsSubmitted: reportsSubmitted || 0,
        draftsPending: draftsPending || 0,
        requiredWalks: settings?.required_walks_per_round || 4,
      }}
      walkHistory={(walkHistory || []).map(w => {
        const slot = w.walk_slots as unknown as {
          id: string; location_name: string; walk_date: string;
          start_time: string; end_time: string;
          survey_rounds: { name: string } | null
        }
        const obs = obsMap.get(slot?.id)
        return {
          membershipId: w.id,
          slotId: slot?.id || '',
          locationName: slot?.location_name || '',
          walkDate: slot?.walk_date || '',
          startTime: slot?.start_time || '',
          roundName: slot?.survey_rounds?.name || '',
          reportStatus: !obs ? 'none' : obs.status as string,
          sightingCount: obs?.outcome === 'SIGHTED' ? ((obs.sightings as unknown as { count: number }[])?.length || 0) : 0,
        }
      })}
    />
  )
}
