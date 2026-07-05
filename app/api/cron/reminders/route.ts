import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendGuardianWalkReminderEmail, sendWalkReminderEmail } from '@/lib/email';

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
    .select('id, round_id, walk_date, start_time, location_name')
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

  const userIds = [...new Set((allMembers || []).map(member => member.user_id))];
  const roundIds = [...new Set(slots.map(slot => slot.round_id))];
  const { data: guardianRequirements, error: guardianRequirementsError } =
    userIds.length > 0 && roundIds.length > 0
      ? await supabase
          .from('round_participation_requirements')
          .select('user_id, round_id, guardian_name, guardian_email, guardian_email_verified_at')
          .in('user_id', userIds)
          .in('round_id', roundIds)
          .not('guardian_email_verified_at', 'is', null)
      : { data: [], error: null };

  if (guardianRequirementsError) {
    console.error('[Cron] Error fetching guardian requirements:', guardianRequirementsError);
    return NextResponse.json({ error: guardianRequirementsError.message }, { status: 500 });
  }

  const guardianRequirementByUserRound = new Map(
    (guardianRequirements || []).map((requirement) => [
      `${requirement.user_id}:${requirement.round_id}`,
      requirement,
    ])
  );

  let emailCount = 0;
  let guardianEmailCount = 0;

  for (const slot of slots) {
    const members = membersBySlot.get(slot.id) || [];
    const guardianEmailsByAddress = new Map<string, { guardianName: string | null; volunteerNames: string[] }>();

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

      const guardianRequirement = guardianRequirementByUserRound.get(`${member.user_id}:${slot.round_id}`);
      if (guardianRequirement?.guardian_email) {
        const existing = guardianEmailsByAddress.get(guardianRequirement.guardian_email) || {
          guardianName: guardianRequirement.guardian_name,
          volunteerNames: [],
        };
        existing.volunteerNames.push(profile?.full_name || profile?.email || 'Volunteer');
        guardianEmailsByAddress.set(guardianRequirement.guardian_email, existing);
      }
    }

    for (const [guardianEmail, guardianReminder] of guardianEmailsByAddress) {
      await sendGuardianWalkReminderEmail(
        guardianEmail,
        guardianReminder.guardianName,
        {
          date: slot.walk_date,
          time: slot.start_time,
          location: slot.location_name,
        },
        guardianReminder.volunteerNames
      );
      guardianEmailCount++;
      emailCount++;
    }
  }

  return NextResponse.json({
    success: true,
    emailsSent: emailCount,
    guardianEmailsSent: guardianEmailCount,
    date: dateStr,
  });
}
