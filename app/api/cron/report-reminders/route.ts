import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendReportReminderEmail } from '@/lib/email'
import { getAppDateString } from '@/lib/utils/walk-participation'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Reminder cron is not configured' }, { status: 503 })
  }
  if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Date arithmetic uses Singapore calendar dates, independent of the host timezone.
  const today = new Date(`${getAppDateString()}T00:00:00Z`)
  const dates = new Map<string, 3 | 7>()
  for (const day of [3, 7] as const) {
    const date = new Date(today)
    date.setUTCDate(date.getUTCDate() - day)
    dates.set(date.toISOString().slice(0, 10), day)
  }

  const supabase = createAdminClient()
  const { data: slots, error: slotsError } = await supabase
    .from('walk_slots')
    .select('id, walk_date, start_time, location_name, observations(status)')
    .in('walk_date', [...dates.keys()])
  if (slotsError) return NextResponse.json({ error: slotsError.message }, { status: 500 })
  const pending = (slots ?? []).filter(slot => slot.observations?.status !== 'SUBMITTED')
  if (pending.length === 0) return NextResponse.json({ success: true, emailsSent: 0 })

  const slotIds = pending.map(slot => slot.id)
  const { data: members, error: membersError } = await supabase
    .from('slot_memberships')
    .select('slot_id, user_id, profiles:user_id(full_name, email, status)')
    .in('slot_id', slotIds)
    .eq('status', 'ACTIVE')
  if (membersError) return NextResponse.json({ error: membersError.message }, { status: 500 })
  const { data: deliveries, error: deliveryError } = await supabase
    .from('report_reminder_deliveries')
    .select('slot_id, user_id, reminder_day')
    .in('slot_id', slotIds)
  if (deliveryError) return NextResponse.json({ error: deliveryError.message }, { status: 500 })

  const sent = new Set((deliveries ?? []).map(item => `${item.slot_id}/${item.user_id}/${item.reminder_day}`))
  let emailsSent = 0
  let failed = false
  for (const slot of pending) {
    const day = dates.get(slot.walk_date)
    if (!day) continue
    for (const member of members ?? []) {
      const profile = member.profiles
      if (member.slot_id !== slot.id || !profile?.email || profile.status !== 'ACTIVE') continue
      if (sent.has(`${slot.id}/${member.user_id}/${day}`)) continue
      const success = await sendReportReminderEmail(
        profile.email, profile.full_name,
        { date: slot.walk_date, time: slot.start_time, location: slot.location_name },
        slot.id, day
      )
      if (!success) { failed = true; continue }
      const { error } = await supabase.from('report_reminder_deliveries').upsert({
        slot_id: slot.id, user_id: member.user_id, reminder_day: day,
      }, { onConflict: 'slot_id,user_id,reminder_day', ignoreDuplicates: true })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      emailsSent++
    }
  }
  return NextResponse.json({ success: !failed, emailsSent }, { status: failed ? 502 : 200 })
}
