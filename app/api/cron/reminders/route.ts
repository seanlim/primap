import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendWalkReminderEmail } from '@/lib/email';
import {
  DEFAULT_REMINDER_SEND_TIME,
  DEFAULT_REMINDER_SEND_WEEKDAY,
  DEFAULT_REMINDER_WINDOW_LENGTH_DAYS,
  DEFAULT_REMINDER_WINDOW_START_OFFSET_DAYS,
} from '@/lib/constants/settings';
import {
  formatReminderTimeForInput,
  getReminderCoverageWindow,
} from '@/lib/utils/reminder-schedule';
import { APP_TIME_ZONE } from '@/lib/utils/walk-participation';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Simple authorization check for cron jobs
  const authHeader = req.headers.get('Authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: settings } = await supabase
    .from('app_settings')
    .select('reminder_send_weekday, reminder_send_time, reminder_window_start_offset_days, reminder_window_length_days')
    .limit(1)
    .single()

  const schedule = {
    reminderSendWeekday: settings?.reminder_send_weekday ?? DEFAULT_REMINDER_SEND_WEEKDAY,
    reminderSendTime: settings?.reminder_send_time ?? DEFAULT_REMINDER_SEND_TIME,
    reminderWindowStartOffsetDays:
      settings?.reminder_window_start_offset_days ?? DEFAULT_REMINDER_WINDOW_START_OFFSET_DAYS,
    reminderWindowLengthDays:
      settings?.reminder_window_length_days ?? DEFAULT_REMINDER_WINDOW_LENGTH_DAYS,
  }

  const window = getReminderCoverageWindow(new Date(), schedule)

  console.log(
    `[Cron] Checking reminder window ${window.startDate} to ${window.endDate} (send weekday ${schedule.reminderSendWeekday} at ${formatReminderTimeForInput(schedule.reminderSendTime)} ${APP_TIME_ZONE})`
  );

  const { data: slots, error: slotsError } = await supabase
    .from('walk_slots')
    .select('id, walk_date, start_time, location_name, reminder_sent_at')
    .gte('walk_date', window.startDate)
    .lte('walk_date', window.endDate)
    .is('reminder_sent_at', null);

  if (slotsError) {
    console.error('[Cron] Error fetching slots:', slotsError);
    return NextResponse.json({ error: slotsError.message }, { status: 500 });
  }

  if (!slots || slots.length === 0) {
    console.log('[Cron] No walks scheduled in the active reminder window.');
    return NextResponse.json({
      message: 'No walks scheduled.',
      startDate: window.startDate,
      endDate: window.endDate,
    });
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
    const participants = members
      .map((member) => {
        const profile = member.profiles;
        if (!profile?.email) return null;
        return { fullName: profile.full_name, email: profile.email };
      })
      .filter((participant) => participant !== null);

    for (const member of members) {
      const profile = member.profiles;
      if (profile?.email) {
        await sendWalkReminderEmail(
          profile.email,
          profile.full_name,
          {
            date: slot.walk_date,
            time: slot.start_time,
            location: slot.location_name
          },
          participants
        );
        emailCount++;
      }
    }

    const { error: slotUpdateError } = await supabase
      .from('walk_slots')
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq('id', slot.id);
    if (slotUpdateError) {
      console.error(`[Cron] Error updating reminder_sent_at for slot ${slot.id}:`, slotUpdateError);
      return NextResponse.json({ error: slotUpdateError.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    success: true,
    emailsSent: emailCount,
    slotsCount: slots.length,
    startDate: window.startDate,
    endDate: window.endDate,
  });
}
