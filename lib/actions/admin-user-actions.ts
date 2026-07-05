'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import {
  sendAccountApprovedEmail,
  sendAccountRejectedEmail,
  sendAccountDisabledEmail,
  sendAccountEnabledEmail,
  sendRolePromotedEmail,
  sendRoleDemotedEmail,
} from '@/lib/email'
import { isProfileContactComplete } from '@/lib/auth/contact-profile'

interface AdminActionResult {
  success?: true
  error?: string
}

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'ADMIN') throw new Error('Not authorized')
  return { supabase, adminId: user.id }
}

export async function approveUser(userId: string): Promise<AdminActionResult> {
  const { supabase } = await requireAdmin()

  const { data: targetProfile, error: targetError } = await supabase
    .from('profiles')
    .select('phone_number, phone_verified_at, birth_month')
    .eq('id', userId)
    .single()

  if (targetError) return { error: targetError.message }
  if (!targetProfile) return { error: 'User not found' }
  if (!isProfileContactComplete(targetProfile)) {
    return { error: 'User must complete phone verification before approval' }
  }

  const { data: updatedProfile, error } = await supabase
    .from('profiles')
    .update({ status: 'ACTIVE', updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select('email, full_name')
    .single()

  if (error) return { error: error.message }

  await sendAccountApprovedEmail(updatedProfile.email, updatedProfile.full_name)

  revalidatePath('/admin/users')
  return { success: true }
}

export async function rejectUser(userId: string): Promise<AdminActionResult> {
  const { supabase, adminId } = await requireAdmin()
  if (userId === adminId) return { error: 'Cannot reject your own account' }

  const { data: updatedProfile, error } = await supabase
    .from('profiles')
    .update({ status: 'REJECTED', updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select('email, full_name')
    .single()

  if (error) return { error: error.message }

  await sendAccountRejectedEmail(updatedProfile.email, updatedProfile.full_name)

  revalidatePath('/admin/users')
  return { success: true }
}

export async function disableUser(userId: string): Promise<AdminActionResult> {
  const { supabase, adminId } = await requireAdmin()
  if (userId === adminId) return { error: 'Cannot disable your own account' }

  const { data: updatedProfile, error } = await supabase
    .from('profiles')
    .update({ status: 'DISABLED', updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select('email, full_name')
    .single()

  if (error) return { error: error.message }

  await sendAccountDisabledEmail(updatedProfile.email, updatedProfile.full_name)

  revalidatePath('/admin/users')
  return { success: true }
}

export async function enableUser(userId: string): Promise<AdminActionResult> {
  const { supabase } = await requireAdmin()

  const { data: updatedProfile, error } = await supabase
    .from('profiles')
    .update({ status: 'ACTIVE', updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select('email, full_name')
    .single()

  if (error) return { error: error.message }

  await sendAccountEnabledEmail(updatedProfile.email, updatedProfile.full_name)

  revalidatePath('/admin/users')
  return { success: true }
}

export async function setUserRole(userId: string, role: 'ADMIN' | 'VOLUNTEER'): Promise<AdminActionResult> {
  const { supabase, adminId } = await requireAdmin()
  if (userId === adminId && role === 'VOLUNTEER') return { error: 'Cannot demote your own account' }

  const { data: target, error: fetchError } = await supabase
    .from('profiles')
    .select('status, email, full_name')
    .eq('id', userId)
    .single()

  if (fetchError) return { error: fetchError.message }
  if (target.status !== 'ACTIVE') return { error: 'Can only change role for active users' }

  const { error } = await supabase
    .from('profiles')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select('id')
    .single()

  if (error) return { error: error.message }

  if (role === 'ADMIN') {
    await sendRolePromotedEmail(target.email, target.full_name)
  } else {
    await sendRoleDemotedEmail(target.email, target.full_name)
  }

  revalidatePath('/admin/users')
  return { success: true }
}
