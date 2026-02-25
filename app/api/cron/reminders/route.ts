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

  // Get tomorrow's date in YYYY-MM-DD format based on server time (UTC usually)
  // Ideally this should respect the timezone of the deployment (Singapore/Asia)
  // For now, using UTC date + 1 day as approximation or assuming server runs in UTC.
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split('T')[0];

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

  let emailCount = 0;

  for (const slot of slots) {
    // Fetch active members for this slot
    const { data: members, error: membersError } = await supabase
      .from('slot_memberships')
      .select('user_id, profiles:user_id(full_name, email)')
      .eq('slot_id', slot.id)
      .eq('status', 'ACTIVE');
    
    if (membersError) {
      console.error(`[Cron] Error fetching members for slot ${slot.id}:`, membersError);
      continue;
    }

    if (!members) continue;

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
