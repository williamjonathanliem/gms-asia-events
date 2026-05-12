'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentStaffUser } from '@/lib/supabase/auth'
import { revalidatePath } from 'next/cache'
import { slugify } from '@/lib/utils'
import type { CustomField, EventWithPackages, Package } from '@/lib/types/database'

async function requireSuperAdmin() {
  const staff = await getCurrentStaffUser()
  if (staff?.role !== 'super_admin') throw new Error('Unauthorised')
}

// ── Events ────────────────────────────────────────────────────

export async function createEvent(data: {
  name: string
  slug?: string
  date: string
  location: string
  form_title?: string
  form_subtitle?: string
}): Promise<{ event?: EventWithPackages; error?: string }> {
  try {
    await requireSuperAdmin()
    const supabase = createServiceClient()

    const { data: event, error } = await supabase
      .from('events')
      .insert({
        name: data.name.trim(),
        slug: (data.slug?.trim() || slugify(data.name)).toLowerCase(),
        date: data.date,
        location: data.location.trim(),
        form_title: data.form_title?.trim() || null,
        form_subtitle: data.form_subtitle?.trim() || null,
        is_active: false,
        registration_open: true,
        custom_fields: [],
      })
      .select('*')
      .single()

    if (error) return { error: error.message }
    revalidatePath('/dashboard/events')
    return { event: { ...event, packages: [] } as EventWithPackages }
  } catch (e: any) {
    return { error: e.message }
  }
}

export async function updateEvent(
  id: string,
  data: Partial<{
    name: string
    slug: string
    date: string
    location: string
    form_title: string | null
    form_subtitle: string | null
    is_active: boolean
    registration_open: boolean
  }>
): Promise<{ error?: string }> {
  try {
    await requireSuperAdmin()
    const supabase = createServiceClient()

    // Deactivate all other events first if setting this one active
    if (data.is_active === true) {
      await supabase.from('events').update({ is_active: false }).neq('id', id)
    }

    const { error } = await supabase.from('events').update(data).eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/dashboard/events')
    return {}
  } catch (e: any) {
    return { error: e.message }
  }
}

export async function deleteEvent(id: string): Promise<{ error?: string }> {
  try {
    await requireSuperAdmin()
    const supabase = createServiceClient()
    const { error } = await supabase.from('events').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/dashboard/events')
    return {}
  } catch (e: any) {
    return { error: e.message }
  }
}

// ── Packages ──────────────────────────────────────────────────

export async function createPackage(data: {
  event_id: string
  name: string
  price: number
  toolkit_items: string[]
}): Promise<{ pkg?: Package; error?: string }> {
  try {
    await requireSuperAdmin()
    const supabase = createServiceClient()

    const { data: pkg, error } = await supabase
      .from('packages')
      .insert({
        event_id: data.event_id,
        name: data.name.trim(),
        price: data.price,
        toolkit_items: data.toolkit_items,
      })
      .select('*')
      .single()

    if (error) return { error: error.message }
    revalidatePath('/dashboard/events')
    return { pkg: pkg as Package }
  } catch (e: any) {
    return { error: e.message }
  }
}

export async function updatePackage(
  id: string,
  data: { name?: string; price?: number; toolkit_items?: string[] }
): Promise<{ error?: string }> {
  try {
    await requireSuperAdmin()
    const supabase = createServiceClient()
    const { error } = await supabase.from('packages').update(data).eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/dashboard/events')
    return {}
  } catch (e: any) {
    return { error: e.message }
  }
}

export async function deletePackage(id: string): Promise<{ error?: string }> {
  try {
    await requireSuperAdmin()
    const supabase = createServiceClient()
    const { error } = await supabase.from('packages').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/dashboard/events')
    return {}
  } catch (e: any) {
    return { error: e.message }
  }
}

// ── Custom Fields ─────────────────────────────────────────────

export async function updateCustomFields(
  eventId: string,
  fields: CustomField[]
): Promise<{ error?: string }> {
  try {
    await requireSuperAdmin()
    const supabase = createServiceClient()
    const { error } = await supabase
      .from('events')
      .update({ custom_fields: fields })
      .eq('id', eventId)
    if (error) return { error: error.message }
    revalidatePath('/dashboard/events')
    return {}
  } catch (e: any) {
    return { error: e.message }
  }
}
