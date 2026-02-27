'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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
  return supabase
}

import { sendAccountApprovedEmail } from '@/lib/email'

export async function approveUser(userId: string) {
  const supabase = await requireAdmin()
  const { data: updatedProfile, error } = await supabase
    .from('profiles')
    .update({ status: 'ACTIVE', updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select('email, full_name')
    .single()

  if (error) return { error: error.message }
  
  if (updatedProfile) {
    await sendAccountApprovedEmail(updatedProfile.email, updatedProfile.full_name)
  }

  revalidatePath('/admin/users')
  return { success: true }
}

export async function rejectUser(userId: string) {
  const supabase = await requireAdmin()
  const { error } = await supabase
    .from('profiles')
    .update({ status: 'REJECTED', updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (error) return { error: error.message }
  revalidatePath('/admin/users')
  return { success: true }
}

export async function disableUser(userId: string) {
  const supabase = await requireAdmin()
  const { error } = await supabase
    .from('profiles')
    .update({ status: 'DISABLED' })
    .eq('id', userId)

  if (error) return { error: error.message }
  revalidatePath('/admin/users')
  return { success: true }
}

export async function enableUser(userId: string) {
  const supabase = await requireAdmin()
  const { error } = await supabase
    .from('profiles')
    .update({ status: 'ACTIVE' })
    .eq('id', userId)

  if (error) return { error: error.message }
  revalidatePath('/admin/users')
  return { success: true }
}

export async function setUserRole(userId: string, role: 'ADMIN' | 'VOLUNTEER') {
  const supabase = await requireAdmin()
  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId)

  if (error) return { error: error.message }
  revalidatePath('/admin/users')
  return { success: true }
}
