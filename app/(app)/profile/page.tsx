import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ProfileClient } from './profile-client'
import type { WalkRef, HistoryObservation } from '@/lib/types/supabase-helpers'
import { hasWalkEnded } from '@/lib/utils/walk-participation'

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

  const [{ data: activeMemberships }, { data: submittedObservationHistory }] = await Promise.all([
    supabase
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
      .limit(20),
    supabase
      .from('observations')
      .select(`
        id,
        slot_id,
        status,
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
      .eq('status', 'SUBMITTED'),
  ])

  const activeWalkHistory = activeMemberships || []
  const activeSlotIds = activeWalkHistory
    .map((membership) => (membership.walk_slots as unknown as WalkRef)?.id)
    .filter(Boolean)

  const { count: draftsPending } = activeSlotIds.length > 0
    ? await supabase
        .from('observations')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'DRAFT')
        .in('slot_id', activeSlotIds)
    : { count: 0 }

  const walkHistoryItems = [
    ...activeWalkHistory.map((membership) => ({
      membershipId: membership.id,
      slot: membership.walk_slots as unknown as WalkRef,
      historyType: 'active' as const,
    })),
    ...(submittedObservationHistory || [])
      .filter((observation) => !activeSlotIds.includes(observation.slot_id))
      .map((observation) => ({
        membershipId: observation.id,
        slot: observation.walk_slots as unknown as WalkRef,
        historyType: 'submitted' as const,
      })),
  ]
    .filter((item) => item.slot && (item.historyType === 'active' || hasWalkEnded(item.slot.walk_date, item.slot.end_time)))
    .sort((a, b) => {
      const aTime = new Date(`${a.slot.walk_date}T${a.slot.start_time}`).getTime()
      const bTime = new Date(`${b.slot.walk_date}T${b.slot.start_time}`).getTime()
      return bTime - aTime
    })
    .slice(0, 20)

  const walkSlotIds = walkHistoryItems
    .map(w => w.slot?.id)
    .filter(Boolean)

  const { data: historyObservations } = walkSlotIds.length > 0
    ? await supabase
        .from('observations')
        .select('slot_id, status, outcome, sightings(count)')
        .eq('user_id', user.id)
        .in('slot_id', walkSlotIds)
    : { data: [] }

  const obsMap = new Map(
    (historyObservations || []).map(o => [o.slot_id, o as unknown as HistoryObservation])
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
      walkHistory={walkHistoryItems.map(w => {
        const slot = w.slot
        const obs = obsMap.get(slot?.id)
        return {
          membershipId: w.membershipId,
          slotId: slot?.id || '',
          locationName: slot?.location_name || '',
          walkDate: slot?.walk_date || '',
          startTime: slot?.start_time || '',
          roundName: slot?.survey_rounds?.name || '',
          reportStatus: !obs ? 'none' : obs.status as string,
          sightingCount: obs?.outcome === 'SIGHTED' ? ((obs.sightings as unknown as { count: number }[])?.[0]?.count || 0) : 0,
        }
      })}
    />
  )
}
