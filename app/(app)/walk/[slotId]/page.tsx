import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { SlotDetailClient } from './slot-detail-client'

export const dynamic = 'force-dynamic'

export default async function SlotDetailPage({
  params,
}: {
  params: Promise<{ slotId: string }>
}) {
  const { slotId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: slot } = await supabase
    .from('walk_slots')
    .select(`
      *,
      survey_rounds (name, status),
      slot_memberships (
        id,
        user_id,
        status,
        joined_at,
        profiles:user_id (full_name, email, avatar_url)
      )
    `)
    .eq('id', slotId)
    .single()

  if (!slot) notFound()

  const memberships = (slot.slot_memberships as unknown as {
    id: string; user_id: string; status: string; joined_at: string;
    profiles: { full_name: string | null; email: string; avatar_url: string | null }
  }[]).filter(m => m.status === 'ACTIVE')

  const userMembership = memberships.find(m => m.user_id === user.id)
  const round = slot.survey_rounds as unknown as { name: string; status: string }

  return (
    <SlotDetailClient
      slot={{
        id: slot.id,
        locationName: slot.location_name,
        walkDate: slot.walk_date,
        startTime: slot.start_time,
        endTime: slot.end_time,
        maxVolunteers: slot.max_volunteers,
        notes: slot.notes,
        roundName: round?.name || '',
      }}
      members={memberships.map(m => ({
        userId: m.user_id,
        fullName: m.profiles?.full_name || null,
        email: m.profiles?.email || '',
        joinedAt: m.joined_at,
      }))}
      isJoined={!!userMembership}
      isFull={memberships.length >= slot.max_volunteers}
      currentUserId={user.id}
    />
  )
}
