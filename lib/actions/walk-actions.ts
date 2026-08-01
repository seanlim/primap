'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { sendWalkCancellationEmail, sendWalkInvitationEmail } from '@/lib/email'
import { getJoinBlockInfo, hasWalkStarted } from '@/lib/utils/walk-participation'
import { OBSERVATION_MEDIA_BUCKET } from '@/lib/utils/storage'

type ActionResult = { success?: true; warning?: string; error?: string }

function revalidateWalkViews(walkId: string) {
  revalidatePath('/walk')
  revalidatePath(`/walk/${walkId}`)
  revalidatePath('/home')
  revalidatePath('/report')
  revalidatePath(`/report/${walkId}`)
  revalidatePath('/profile')
}

export async function joinWalk(walkId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  interface JoinSlotQueryRow {
    walk_date: string
    start_time: string
    max_volunteers: number
    survey_rounds: { status?: string } | null
    slot_memberships: Array<{ user_id: string; status: string }>
    slot_invitations: Array<{ invited_user_id: string; status: string }>
  }

  const { data: slotRaw, error: slotError } = await supabase
    .from('walk_slots')
    .select(`
      walk_date,
      start_time,
      max_volunteers,
      survey_rounds (status),
      slot_memberships (user_id, status),
      slot_invitations (invited_user_id, status)
    `)
    .eq('id', walkId)
    .single()

  if (slotError) return { error: slotError.message }
  if (!slotRaw) return { error: 'Walk slot not found.' }

  const slot = slotRaw as unknown as JoinSlotQueryRow
  const round = slot.survey_rounds
  const memberships = slot.slot_memberships || []
  const invitations = slot.slot_invitations || []
  const activeMemberships = memberships.filter((membership) => membership.status === 'ACTIVE')
  const pendingInvitations = invitations.filter((invitation) => invitation.status === 'PENDING')
  const pendingInvitationsReservedByOthers = pendingInvitations
    .filter((invitation) => invitation.invited_user_id !== user.id)
  const alreadyJoined = activeMemberships.some((membership) => membership.user_id === user.id)
  const joinBlock = getJoinBlockInfo({
    roundStatus: round?.status,
    hasStarted: hasWalkStarted(slot.walk_date, slot.start_time),
    isFull: activeMemberships.length + pendingInvitationsReservedByOthers.length >= slot.max_volunteers,
  })

  if (joinBlock?.label === 'Round Closed') return { error: joinBlock.description }
  if (joinBlock?.label === 'Walk Started') return { error: joinBlock.description }
  if (alreadyJoined) return { error: 'You have already joined this walk.' }
  if (joinBlock?.label === 'Walk Full') return { error: joinBlock.description }

  // The RPC remains the atomic source of truth for membership + draft-observation
  // creation/reactivation. These prechecks only keep the volunteer UX and server
  // action aligned before we hand off to the database boundary.
  const { data, error } = await supabase.rpc('join_slot_with_observation', {
    p_slot_id: walkId,
    p_user_id: user.id,
  })

  if (error) return { error: error.message }

  const result = data as { success?: boolean; error?: string }
  if (result.error) return { error: result.error }

  revalidateWalkViews(walkId)
  return { success: true }
}


export async function cancelWalk(walkId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const warnings: string[] = []

  const { data, error } = await supabase.rpc('cancel_slot_with_draft_cleanup', {
    p_slot_id: walkId,
  })

  if (error) return { error: error.message }

  const result = data as {
    success?: boolean
    error?: string
    deleted_draft_count?: number
    file_paths?: string[]
  } | null
  if (!result || typeof result !== 'object') {
    return { error: 'Unexpected cancellation response.' }
  }
  if (result.error) return { error: result.error }
  if (result.success !== true) return { error: 'Unexpected cancellation response.' }

  const filePaths = Array.isArray(result.file_paths)
    ? result.file_paths.filter((path): path is string => typeof path === 'string' && path.length > 0)
    : []

  if (filePaths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from(OBSERVATION_MEDIA_BUCKET)
      .remove(filePaths)

    if (storageError) {
      console.error('Error deleting draft observation media after cancellation:', storageError)
      warnings.push('Cancelled successfully, but failed to remove your draft report media.')
    }
  }

  // Notify other members
  try {
    // 1. Get walk info
    const { data: slot } = await supabase
      .from('walk_slots')
      .select('walk_date, start_time, location_name')
      .eq('id', walkId)
      .single()

    // 2. Get cancelling user info
    const { data: cancellingProfile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single()

    const cancellingName = cancellingProfile?.full_name || cancellingProfile?.email || 'A volunteer'

    // 3. Get other active members
    interface MembershipRow {
      user_id: string
      profiles: { email: string } | null
    }

    const { data: otherMembersRaw } = await supabase
      .from('slot_memberships')
      .select('user_id, profiles:user_id(email)')
      .eq('slot_id', walkId)
      .eq('status', 'ACTIVE')
      .neq('user_id', user.id)

    const otherMembers = (otherMembersRaw || []) as unknown as MembershipRow[]
    if (slot && otherMembers.length > 0) {
      const recipients = otherMembers
        .map(m => m.profiles?.email)
        .filter((e): e is string => Boolean(e))

      if (recipients.length > 0) {
        await sendWalkCancellationEmail(
          recipients,
          {
            date: slot.walk_date,
            time: slot.start_time,
            location: slot.location_name
          },
          cancellingName
        )
      }
    }
  } catch (err) {
    console.error('Error sending cancellation emails:', err)
    warnings.push('Cancelled successfully, but failed to notify other members.')
  }

  revalidateWalkViews(walkId)
  revalidatePath('/admin/reports')
  revalidatePath(`/admin/reports/${walkId}`)
  return warnings.length > 0
    ? { success: true, warning: warnings.join(' ') }
    : { success: true }
}

export interface InviteCandidate {
  id: string
  fullName: string | null
  email: string
}

export async function searchInviteCandidates(
  walkId: string,
  query: string
): Promise<{ candidates: InviteCandidate[] } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  interface SlotInviteSearchRow {
    slot_memberships: Array<{ user_id: string; status: string }>
    slot_invitations: Array<{ invited_user_id: string; status: string }>
  }

  const { data: slotRaw, error: slotError } = await supabase
    .from('walk_slots')
    .select(`
      slot_memberships (user_id, status),
      slot_invitations (invited_user_id, status)
    `)
    .eq('id', walkId)
    .single()

  if (slotError) return { error: slotError.message }
  if (!slotRaw) return { error: 'Walk slot not found.' }

  const slot = slotRaw as unknown as SlotInviteSearchRow
  const activeMemberIds = new Set(
    (slot.slot_memberships || [])
      .filter((membership) => membership.status === 'ACTIVE')
      .map((membership) => membership.user_id)
  )

  if (!activeMemberIds.has(user.id)) {
    return { error: 'Only active group members can invite volunteers.' }
  }

  const pendingInviteeIds = new Set(
    (slot.slot_invitations || [])
      .filter((invitation) => invitation.status === 'PENDING')
      .map((invitation) => invitation.invited_user_id)
  )

  const adminSupabase = createAdminClient()
  const { data: profiles, error: profilesError } = await adminSupabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('status', 'ACTIVE')
    .eq('role', 'VOLUNTEER')
    .limit(100)

  if (profilesError) return { error: profilesError.message }

  const normalizedQuery = query.trim().toLowerCase()
  const candidates = (profiles || [])
    .filter((profile) => profile.id !== user.id)
    .filter((profile) => !activeMemberIds.has(profile.id))
    .filter((profile) => !pendingInviteeIds.has(profile.id))
    .filter((profile) => {
      if (!normalizedQuery) return true
      return (
        (profile.full_name || '').toLowerCase().includes(normalizedQuery) ||
        profile.email.toLowerCase().includes(normalizedQuery)
      )
    })
    .slice(0, 10)
    .map((profile) => ({
      id: profile.id,
      fullName: profile.full_name,
      email: profile.email,
    }))

  return { candidates }
}

export async function inviteVolunteerToWalk(
  walkId: string,
  invitedUserId: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data, error } = await supabase.rpc('create_slot_invitation', {
    p_slot_id: walkId,
    p_invited_user_id: invitedUserId,
  })

  if (error) return { error: error.message }

  const result = data as { success?: boolean; error?: string; invitation_id?: string } | null
  if (!result || typeof result !== 'object') {
    return { error: 'Unexpected invitation response.' }
  }
  if (result.error) return { error: result.error }
  if (result.success !== true) return { error: 'Unexpected invitation response.' }

  const warnings: string[] = []

  try {
    const adminSupabase = createAdminClient()
    const [{ data: slot }, { data: invitedProfile }, { data: inviterProfile }] = await Promise.all([
      adminSupabase
        .from('walk_slots')
        .select('id, walk_date, start_time, location_name')
        .eq('id', walkId)
        .single(),
      adminSupabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', invitedUserId)
        .single(),
      adminSupabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', user.id)
        .single(),
    ])

    if (slot && invitedProfile?.email) {
      await sendWalkInvitationEmail(
        invitedProfile.email,
        invitedProfile.full_name,
        inviterProfile?.full_name || inviterProfile?.email || 'A volunteer',
        {
          id: slot.id,
          date: slot.walk_date,
          time: slot.start_time,
          location: slot.location_name,
        }
      )
    }
  } catch (err) {
    console.error('Error sending walk invitation email:', err)
    warnings.push('Invited successfully, but failed to send the invitation email.')
  }

  revalidateWalkViews(walkId)
  return warnings.length > 0
    ? { success: true, warning: warnings.join(' ') }
    : { success: true }
}

export async function respondToSlotInvitation(
  invitationId: string,
  response: 'ACCEPTED' | 'REJECTED'
): Promise<ActionResult> {
  if (response !== 'ACCEPTED' && response !== 'REJECTED') {
    return { error: 'Invalid invitation response.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: invitation } = await supabase
    .from('slot_invitations')
    .select('slot_id')
    .eq('id', invitationId)
    .maybeSingle()

  const { data, error } = await supabase.rpc('respond_to_slot_invitation', {
    p_invitation_id: invitationId,
    p_response: response,
  })

  if (error) return { error: error.message }

  const result = data as { success?: boolean; error?: string } | null
  if (!result || typeof result !== 'object') {
    return { error: 'Unexpected invitation response.' }
  }
  if (result.error) return { error: result.error }
  if (result.success !== true) return { error: 'Unexpected invitation response.' }

  if (invitation?.slot_id) {
    revalidateWalkViews(invitation.slot_id)
  } else {
    revalidatePath('/walk')
    revalidatePath('/home')
    revalidatePath('/profile')
  }

  return { success: true }
}

export async function cancelSlotInvitation(invitationId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: invitation } = await supabase
    .from('slot_invitations')
    .select('slot_id')
    .eq('id', invitationId)
    .maybeSingle()

  const { data, error } = await supabase.rpc('cancel_slot_invitation', {
    p_invitation_id: invitationId,
  })

  if (error) return { error: error.message }

  const result = data as { success?: boolean; error?: string } | null
  if (!result || typeof result !== 'object') {
    return { error: 'Unexpected invitation response.' }
  }
  if (result.error) return { error: result.error }
  if (result.success !== true) return { error: 'Unexpected invitation response.' }

  if (invitation?.slot_id) {
    revalidateWalkViews(invitation.slot_id)
  } else {
    revalidatePath('/walk')
  }

  return { success: true }
}
