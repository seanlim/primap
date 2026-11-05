'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { AttendanceStatus } from '@/lib/types/supabase-helpers'

export interface AttendanceEntry {
  userId: string
  status: AttendanceStatus
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

  const normalized = new Map<string, AttendanceStatus>()
  for (const entry of entries) {
    if (!entry?.userId || (entry.status !== 'PRESENT' && entry.status !== 'ABSENT')) {
      return { error: 'Invalid attendance entry.' }
    }
    normalized.set(entry.userId, entry.status)
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

  const markedAt = new Date().toISOString()
  const { error } = await supabase
    .from('slot_attendance')
    .upsert(
      targetUserIds.map(userId => ({
        slot_id: slotId,
        user_id: userId,
        status: normalized.get(userId) as AttendanceStatus,
        marked_by: user.id,
        marked_at: markedAt,
      })),
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
