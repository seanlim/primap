import { createClient } from '@/lib/supabase/server'
import { WalksClient } from './walks-client'
import type { WalkWithMembership } from '@/lib/types/supabase-helpers'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AdminWalksPage({ params }: { 
  params: Promise<({ roundId: string })>
}) {
  const supabase = await createClient()
  const { roundId } = await params;
  const { data: walks } = await supabase
    .from('walk_slots')
    .select('*, survey_rounds(name, status, start_date, end_date), slot_memberships(profiles(id, full_name, email), status, joined_at, cancelled_at)')
    .filter('round_id', 'eq', roundId)
    .order('walk_date', { ascending: false })

  const { data: selectedRound } = await supabase
    .from('survey_rounds')
    .select('id, name, start_date, end_date')
    .eq('id', roundId)
    .single()
  const typed = (walks || []) as unknown as WalkWithMembership[]
  
  return (
    <div>
      {selectedRound ? (
        <WalksClient
          walks={typed.map(s => ({
            id: s.id,
            roundId: s.round_id,
            roundName: s.survey_rounds?.name || '',
            roundStatus: s.survey_rounds?.status || '',
            roundStartDate: s.survey_rounds?.start_date || '',
            roundEndDate: s.survey_rounds?.end_date || '',
            locationName: s.location_name,
            walkDate: s.walk_date,
            startTime: s.start_time,
            endTime: s.end_time,
            maxVolunteers: s.max_volunteers,
            volunteers: s.slot_memberships.map(m => ({
              user_id: m.profiles.id,
              name: m.profiles.full_name,
              email: m.profiles.email,
              status: m.status,
              joined_at: m.joined_at,
              cancelled_at: m.cancelled_at,
            })),
            memberCount: s.slot_memberships?.filter(m => m.status === 'ACTIVE').length || 0,
            reminderSentAt: s.reminder_sent_at,
          }))}
          round={{
            id: selectedRound.id,
            name: selectedRound.name,
            startDate: selectedRound.start_date,
            endDate: selectedRound.end_date,
          }}
        />
      ) : (
        <div className="flex items-center justify-center h-100">
          <div className="flex flex-col items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900">Round not found</h1>
            <Link href="/admin/rounds" className="text-gray-400 hover:text-gray-600">
              <button
                className="flex items-center gap-1 bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-green-700"
              >
                <ArrowLeft className="w-4 h-4" />
                Go back
              </button>
            </Link>
          </div>
          <div className="flex gap-2">
          </div>
        </div>
      )}
    </div>
  )
}
