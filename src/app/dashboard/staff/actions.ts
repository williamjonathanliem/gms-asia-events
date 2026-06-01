'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentStaffUser } from '@/lib/supabase/auth'
import { revalidatePath } from 'next/cache'
import type { StaffRole } from '@/lib/types/database'

async function requireSuperAdmin() {
  const staff = await getCurrentStaffUser()
  if (staff?.role !== 'super_admin') throw new Error('Unauthorised')
}

export async function inviteStaff(data: {
  email: string
  role: StaffRole
  event_scope: string | null
}): Promise<{ error?: string }> {
  try {
    await requireSuperAdmin()
    const supabase = createServiceClient()

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      'http://localhost:3000'

    // Invite creates the auth.users record and sends the invite email
    const { data: invited, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
      data.email.trim().toLowerCase(),
      { redirectTo: `${origin}/auth/callback?next=/dashboard` }
    )

    if (inviteError) return { error: inviteError.message }
    if (!invited?.user) return { error: 'Invite failed — no user returned' }

    // Create staff_users record immediately (role & scope assigned now)
    const { error: insertError } = await supabase.from('staff_users').upsert(
      {
        id: invited.user.id,
        email: data.email.trim().toLowerCase(),
        role: data.role,
        event_scope: data.event_scope || null,
      },
      { onConflict: 'id' }
    )

    if (insertError) return { error: insertError.message }
    revalidatePath('/dashboard/staff')
    return {}
  } catch (e: any) {
    return { error: e.message }
  }
}

export async function updateStaffMember(
  id: string,
  data: { role: StaffRole; event_scope: string | null }
): Promise<{ error?: string }> {
  try {
    await requireSuperAdmin()
    const supabase = createServiceClient()

    // Prevent demoting the last super_admin
    if (data.role !== 'super_admin') {
      const { count } = await supabase
        .from('staff_users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'super_admin')
      if ((count ?? 0) <= 1) {
        const { data: target } = await supabase
          .from('staff_users')
          .select('role')
          .eq('id', id)
          .single()
        if (target?.role === 'super_admin') {
          return { error: 'Cannot demote the last super admin.' }
        }
      }
    }

    const { error } = await supabase
      .from('staff_users')
      .update({ role: data.role, event_scope: data.event_scope || null })
      .eq('id', id)

    if (error) return { error: error.message }
    revalidatePath('/dashboard/staff')
    return {}
  } catch (e: any) {
    return { error: e.message }
  }
}

export async function removeStaff(id: string): Promise<{ error?: string }> {
  try {
    await requireSuperAdmin()
    const supabase = createServiceClient()

    // Prevent removing the last super_admin
    const { count } = await supabase
      .from('staff_users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'super_admin')

    if ((count ?? 0) <= 1) {
      const { data: target } = await supabase
        .from('staff_users')
        .select('role')
        .eq('id', id)
        .single()
      if (target?.role === 'super_admin') {
        return { error: 'Cannot remove the last super admin.' }
      }
    }

    // Delete auth user (cascades to staff_users via FK)
    const { error } = await supabase.auth.admin.deleteUser(id)
    if (error) return { error: error.message }
    revalidatePath('/dashboard/staff')
    return {}
  } catch (e: any) {
    return { error: e.message }
  }
}
