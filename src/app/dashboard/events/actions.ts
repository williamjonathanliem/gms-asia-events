'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentStaffUser } from '@/lib/supabase/auth'
import { revalidatePath } from 'next/cache'
import { slugify } from '@/lib/utils'
import { DEFAULT_EVENT_CURRENCY, isValidEventCurrency } from '@/lib/currencies'
import type { CoreField, CustomField, EventWithPackages, Package } from '@/lib/types/database'

async function requireSuperAdmin() {
  const staff = await getCurrentStaffUser()
  if (staff?.role !== 'super_admin') throw new Error('Unauthorised')
}

async function requireAdminOrAbove() {
  const staff = await getCurrentStaffUser()
  if (!staff || !['super_admin', 'admin'].includes(staff.role)) throw new Error('Unauthorised')
}

// ── Events ────────────────────────────────────────────────────

export async function createEvent(data: {
  name: string
  slug?: string
  date: string
  location: string
  form_title?: string
  form_subtitle?: string
  currency?: string
}): Promise<{ event?: EventWithPackages; error?: string }> {
  try {
    await requireAdminOrAbove()
    const supabase = createServiceClient()
    const currency = data.currency?.trim() || DEFAULT_EVENT_CURRENCY
    if (!isValidEventCurrency(currency)) {
      return { error: 'Invalid currency selected.' }
    }

    const { data: event, error } = await supabase
      .from('events')
      .insert({
        name: data.name.trim(),
        slug: (data.slug?.trim() || slugify(data.name)).toLowerCase(),
        date: data.date,
        location: data.location.trim(),
        form_title: data.form_title?.trim() || null,
        form_subtitle: data.form_subtitle?.trim() || null,
        currency,
        is_active: false,
        registration_open: true,
        custom_fields: [],
        early_bird_enabled: false,
        early_bird_auto_change: true,
        early_bird_end_date: null,
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
    early_bird_enabled: boolean
    early_bird_auto_change: boolean
    early_bird_end_date: string | null
    currency: string
    form_theme: Record<string, string>
  }>
): Promise<{ error?: string }> {
  try {
    await requireAdminOrAbove()
    const supabase = createServiceClient()

    if (data.currency != null && !isValidEventCurrency(data.currency)) {
      return { error: 'Invalid currency selected.' }
    }

    if (data.early_bird_enabled && data.early_bird_auto_change && !data.early_bird_end_date) {
      return { error: 'Early bird end date is required when Auto change is enabled.' }
    }

    const { error } = await supabase.from('events').update(data).eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/dashboard/events')
    revalidatePath('/register', 'layout')   // invalidate all /register/[slug] pages
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
    revalidatePath('/dashboard/registrations')
    return {}
  } catch (e: any) {
    return { error: e.message }
  }
}

export async function resetEvent(id: string): Promise<{ error?: string; deleted: number }> {
  try {
    await requireSuperAdmin()
    const supabase = createServiceClient()

    // Fetch all registrations so we can clean up storage too
    const { data: regs } = await supabase
      .from('registrations')
      .select('id, payment_screenshot_url')
      .eq('event_id', id)

    const regsData = regs ?? []

    // Delete attendance logs first (FK constraint)
    await supabase.from('attendance_logs').delete().eq('event_id', id)

    // Delete registrations
    const { error } = await supabase.from('registrations').delete().eq('event_id', id)
    if (error) return { error: error.message, deleted: 0 }

    // Best-effort: remove payment screenshots from storage
    const paths = regsData
      .map((r) => r.payment_screenshot_url)
      .filter(Boolean) as string[]
    if (paths.length > 0) {
      await supabase.storage.from('payment-screenshots').remove(paths)
    }

    revalidatePath('/dashboard/registrations')
    revalidatePath('/dashboard/events')
    return { deleted: regsData.length }
  } catch (e: any) {
    return { error: e.message, deleted: 0 }
  }
}

// ── Packages ──────────────────────────────────────────────────

export async function createPackage(data: {
  event_id: string
  name: string
  price: number
  early_bird_price?: number | null
  toolkit_items: string[]
}): Promise<{ pkg?: Package; error?: string }> {
  try {
    await requireAdminOrAbove()
    const supabase = createServiceClient()

    if (
      data.early_bird_price != null &&
      data.early_bird_price >= data.price
    ) {
      return { error: 'Early bird price must be lower than the regular price.' }
    }

    const { data: pkg, error } = await supabase
      .from('packages')
      .insert({
        event_id: data.event_id,
        name: data.name.trim(),
        price: data.price,
        early_bird_price: data.early_bird_price ?? null,
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
  data: {
    name?: string
    price?: number
    early_bird_price?: number | null
    toolkit_items?: string[]
  }
): Promise<{ error?: string }> {
  try {
    await requireAdminOrAbove()
    const supabase = createServiceClient()

    if (data.price != null && data.early_bird_price != null && data.early_bird_price >= data.price) {
      return { error: 'Early bird price must be lower than the regular price.' }
    }

    if (data.early_bird_price != null && data.price == null) {
      const { data: existing } = await supabase.from('packages').select('price').eq('id', id).single()
      if (existing && data.early_bird_price >= Number(existing.price)) {
        return { error: 'Early bird price must be lower than the regular price.' }
      }
    }

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
    await requireAdminOrAbove()
    const supabase = createServiceClient()
    const { error } = await supabase.from('packages').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/dashboard/events')
    return {}
  } catch (e: any) {
    return { error: e.message }
  }
}

// ── Core Fields ───────────────────────────────────────────────

export async function updateCoreFields(
  eventId: string,
  fields: CoreField[]
): Promise<{ error?: string }> {
  try {
    await requireAdminOrAbove()
    const supabase = createServiceClient()
    const { error } = await supabase
      .from('events')
      .update({ core_fields: fields })
      .eq('id', eventId)
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
    await requireAdminOrAbove()
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
