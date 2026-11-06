'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { AttendanceStatus } from '@/lib/types/supabase-helpers'
import { isMinorAtRoundStart } from '@/lib/utils/minor-status'

export interface AttendanceEntry {
  userId: string
  status?: AttendanceStatus
  guardianPresent?: boolean | null
}

const MAX_ATTENDANCE_ENTRIES = 100

/**
 * Record (or correct) attendance for the volunteers in a walk slot.
 *
 * Any active member of the slot can mark attendance for the group, and admins
 * can always override. Toggles in the UI call this one volunteer at a time, so
 * a correction never overwrites another volunteer's row.
 */
export async function saveSlotAttendance(slotId: string, entries: AttendanceEntry[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  if (!slotId) return { error: 'Walk is required.' }
  if (!Array.isArray(entries) || entries.length === 0) {
    return { error: 'Select at least one volunteer.' }
  }
  if (entries.length > MAX_ATTENDANCE_ENTRIES) {
    return { error: 'Too many attendance entries.' }
  }

  const normalized = new Map<string, AttendanceEntry>()
  for (const entry of entries) {
    const hasStatus = entry?.status === 'PRESENT' || entry?.status === 'ABSENT'
    const hasGuardianPresence = Object.prototype.hasOwnProperty.call(entry ?? {}, 'guardianPresent')
    if (!entry?.userId
      || (entry.status !== undefined && !hasStatus)
      || (hasGuardianPresence && entry.guardianPresent !== null && typeof entry.guardianPresent !== 'boolean')
      || (!hasStatus && !hasGuardianPresence)
    ) {
      return { error: 'Invalid attendance entry.' }
    }
    normalized.set(entry.userId, {
      userId: entry.userId,
      ...(hasStatus ? { status: entry.status as AttendanceStatus } : {}),
      ...(hasGuardianPresence ? { guardianPresent: entry.guardianPresent } : {}),
    })
  }

  // Permission check up front so volunteers get a readable error instead of a
  // raw RLS failure. RLS remains the source of truth.
  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single(),
    supabase
      .from('slot_memberships')
      .select('id')
      .eq('slot_id', slotId)
      .eq('user_id', user.id)
      .eq('status', 'ACTIVE')
      .maybeSingle(),
  ])
  const isAdmin = profile?.role === 'ADMIN'
  if (!isAdmin && !membership) {
    return { error: 'You are not part of this walk.' }
  }

  const targetUserIds = [...normalized.keys()]
  const { data: activeMembers, error: memberError } = await supabase
    .from('slot_memberships')
    .select('user_id')
    .eq('slot_id', slotId)
    .eq('status', 'ACTIVE')
    .in('user_id', targetUserIds)

  if (memberError) return { error: memberError.message }

  const activeUserIds = new Set((activeMembers ?? []).map(member => member.user_id))
  if (targetUserIds.some(userId => !activeUserIds.has(userId))) {
    return { error: 'Some volunteers are no longer part of this walk. Refresh and try again.' }
  }

  const entriesWithGuardianPresence = [...normalized.values()].filter(entry =>
    Object.prototype.hasOwnProperty.call(entry, 'guardianPresent') && entry.guardianPresent !== null
  )
  if (entriesWithGuardianPresence.length > 0) {
    const [{ data: slot }, { data: targetProfiles, error: profileError }] = await Promise.all([
      supabase
        .from('walk_slots')
        .select('survey_rounds(start_date)')
        .eq('id', slotId)
        .single(),
      supabase
        .from('profiles')
        .select('id, birth_month')
        .in('id', entriesWithGuardianPresence.map(entry => entry.userId)),
    ])
    if (profileError) return { error: profileError.message }
    const round = slot?.survey_rounds as unknown as { start_date: string } | null
    const birthMonths = new Map((targetProfiles ?? []).map(profile => [profile.id, profile.birth_month]))
    if (!round || entriesWithGuardianPresence.some(entry =>
      !isMinorAtRoundStart(birthMonths.get(entry.userId), round.start_date)
    )) {
      return { error: 'Guardian attendance can only be recorded for minor volunteers.' }
    }
  }

  const { data: existingAttendance, error: existingAttendanceError } = await supabase
    .from('slot_attendance')
    .select('user_id, status, guardian_present')
    .eq('slot_id', slotId)
    .in('user_id', targetUserIds)
  if (existingAttendanceError) return { error: existingAttendanceError.message }
  const existingByUserId = new Map((existingAttendance ?? []).map(row => [row.user_id, row]))

  const markedAt = new Date().toISOString()
  const { error } = await supabase
    .from('slot_attendance')
    .upsert(
      targetUserIds.map(userId => {
        const entry = normalized.get(userId)!
        const existing = existingByUserId.get(userId)
        return {
          slot_id: slotId,
          user_id: userId,
          status: entry.status ?? existing?.status ?? 'PRESENT',
          guardian_present: Object.prototype.hasOwnProperty.call(entry, 'guardianPresent')
            ? entry.guardianPresent
            : existing?.guardian_present ?? null,
          marked_by: user.id,
          marked_at: markedAt,
        }
      }),
      { onConflict: 'slot_id,user_id' }
    )

  if (error) return { error: error.message }

  revalidatePath('/report')
  revalidatePath(`/report/${slotId}`)
  revalidatePath('/profile')
  revalidatePath('/admin')
  revalidatePath('/admin/reports')
  revalidatePath(`/admin/reports/${slotId}`)

  return { success: true as const, markedAt }
}
