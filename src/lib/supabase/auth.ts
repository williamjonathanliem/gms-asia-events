import { createClient } from './server'
import type { StaffUser } from '@/lib/types/database'

export async function getCurrentStaffUser(): Promise<StaffUser | null> {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data } = await supabase
    .from('staff_users')
    .select('*')
    .eq('id', user.id)
    .single()

  return data ?? null
}
