import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendWalkReminderEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Simple authorization check for cron jobs
  const authHeader = req.headers.get('Authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const supabase = createAdminClient();

  // Use Asia/Singapore timezone to compute "tomorrow"
  const sgFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const nowInSG = new Date();
  nowInSG.setDate(nowInSG.getDate() + 1);
  const dateStr = sgFormatter.format(nowInSG); // YYYY-MM-DD

  console.log(`[Cron] Checking for walks on: ${dateStr}`);

  // Fetch slots for tomorrow
  const { data: slots, error: slotsError } = await supabase
    .from('walk_slots')
    .select('id, walk_date, start_time, location_name')
    .eq('walk_date', dateStr);

  if (slotsError) {
    console.error('[Cron] Error fetching slots:', slotsError);
    return NextResponse.json({ error: slotsError.message }, { status: 500 });
  }

  if (!slots || slots.length === 0) {
    console.log('[Cron] No walks scheduled for tomorrow.');
    return NextResponse.json({ message: 'No walks scheduled.', date: dateStr });
  }

  // Batch fetch all active members for all slots at once (fixes N+1)
  const slotIds = slots.map(s => s.id);
  const { data: allMembers, error: membersError } = await supabase
    .from('slot_memberships')
    .select('slot_id, user_id, profiles:user_id(full_name, email)')
    .in('slot_id', slotIds)
    .eq('status', 'ACTIVE');

  if (membersError) {
    console.error('[Cron] Error fetching members:', membersError);
    return NextResponse.json({ error: membersError.message }, { status: 500 });
  }

  // Group members by slot_id
  const membersBySlot = new Map<string, typeof allMembers>();
  for (const member of allMembers || []) {
    const list = membersBySlot.get(member.slot_id) || [];
    list.push(member);
    membersBySlot.set(member.slot_id, list);
  }

  let emailCount = 0;

  for (const slot of slots) {
    const members = membersBySlot.get(slot.id) || [];

    for (const member of members) {
      const profile = member.profiles as unknown as { full_name: string | null; email: string };
      if (profile?.email) {
        await sendWalkReminderEmail(
          profile.email,
          profile.full_name,
          {
            date: slot.walk_date,
            time: slot.start_time,
            location: slot.location_name
          }
        );
        emailCount++;
      }
    }
  }

  return NextResponse.json({ success: true, emailsSent: emailCount, date: dateStr });
}
