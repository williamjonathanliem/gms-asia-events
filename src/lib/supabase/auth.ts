import { cache } from 'react'
import { createClient } from './server'
import type { StaffUser } from '@/lib/types/database'

// cache() deduplicates across a single request — auth runs once even if called by
// multiple server components (layout, page, StatCards, etc.)
export const getCurrentStaffUser = cache(async (): Promise<StaffUser | null> => {
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
})
