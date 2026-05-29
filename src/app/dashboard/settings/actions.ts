'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentStaffUser } from '@/lib/supabase/auth'
import { revalidatePath } from 'next/cache'

async function requireSuperAdmin() {
  const staff = await getCurrentStaffUser()
  if (staff?.role !== 'super_admin') throw new Error('Unauthorised')
}

export async function getGlobalChurches(): Promise<string[]> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'gms_churches')
    .single()
  return (data?.value as string[]) ?? []
}

export async function updateGlobalChurches(
  churches: string[]
): Promise<{ error?: string }> {
  try {
    await requireSuperAdmin()
    const supabase = createServiceClient()
    const { error } = await supabase
      .from('settings')
      .upsert({ key: 'gms_churches', value: churches, updated_at: new Date().toISOString() })
    if (error) return { error: error.message }
    revalidatePath('/dashboard/settings')
    revalidatePath('/dashboard/events')
    return {}
  } catch (e: any) {
    return { error: e.message }
  }
}
