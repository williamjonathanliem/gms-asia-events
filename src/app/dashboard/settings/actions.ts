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

export async function renameChurch(
  oldName: string,
  newName: string
): Promise<{ error?: string; updatedRegistrations?: number }> {
  try {
    await requireSuperAdmin()
    const trimmed = newName.trim()
    if (!trimmed) return { error: 'Name cannot be empty' }
    if (trimmed === oldName) return {}

    const supabase = createServiceClient()

    // Update the settings list
    const churches = await getGlobalChurches()
    const updatedList = churches.map((c) => (c === oldName ? trimmed : c))
    const { error: settingsErr } = await supabase
      .from('settings')
      .upsert({ key: 'gms_churches', value: updatedList, updated_at: new Date().toISOString() })
    if (settingsErr) return { error: settingsErr.message }

    // Update existing registrations that used the old name
    const { count, error: regErr } = await supabase
      .from('registrations')
      .update({ gms_church: trimmed })
      .eq('gms_church', oldName)
      .select('id', { count: 'exact', head: true })
    if (regErr) return { error: regErr.message }

    revalidatePath('/dashboard/settings')
    revalidatePath('/dashboard/registrations')
    return { updatedRegistrations: count ?? 0 }
  } catch (e: any) {
    return { error: e.message }
  }
}

// ── Registration popup ────────────────────────────────────────

export interface RegistrationPopupSettings {
  enabled: boolean
  content: string
}

const DEFAULT_POPUP_CONTENT = `Registration Period
Registration is open until all available seats have been filled.

Registration Confirmation
Your registration will only be confirmed after payment has been successfully received and verified by the Conference team.

Cancellation & Refund Policy
All registrations are non-refundable. Once payment has been made, registration fees cannot be refunded for any reason, including cancellation, schedule conflicts, travel issues, or inability to attend.

Conference Ticket Transfer
Registration is non-transferable and cannot be assigned to another person.

Important Notes
• Participants are responsible for their own travel, accommodation, visa, and other personal expenses unless otherwise stated.
• The organizing committee reserves the right to make necessary adjustments to the event schedule, speakers, or program.
• By submitting this registration form, you confirm that all information provided is accurate and complete.`

export async function getRegistrationPopup(): Promise<RegistrationPopupSettings> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', ['registration_popup_enabled', 'registration_popup_content'])

  const rows = data ?? []
  const enabled = rows.find(r => r.key === 'registration_popup_enabled')?.value ?? true
  const content = rows.find(r => r.key === 'registration_popup_content')?.value ?? DEFAULT_POPUP_CONTENT

  return {
    enabled: enabled as boolean,
    content: content as string,
  }
}

export async function updateRegistrationPopup(
  settings: RegistrationPopupSettings
): Promise<{ error?: string }> {
  try {
    await requireSuperAdmin()
    const supabase = createServiceClient()
    const now = new Date().toISOString()
    const { error } = await supabase.from('settings').upsert([
      { key: 'registration_popup_enabled', value: settings.enabled,  updated_at: now },
      { key: 'registration_popup_content', value: settings.content,  updated_at: now },
    ])
    if (error) return { error: error.message }
    revalidatePath('/dashboard/settings')
    revalidatePath('/register')
    return {}
  } catch (e: any) {
    return { error: e.message }
  }
}
