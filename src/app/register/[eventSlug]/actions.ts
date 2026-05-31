'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { STORAGE_BUCKET } from '@/lib/constants'
import { sendConfirmationEmail } from '@/lib/email'
import { resolveRegistrationPricing } from '@/lib/pricing'
import type { CustomField } from '@/lib/types/database'
import { resolveCoreFields } from '@/lib/types/database'

export type RegisterFormState = {
  error?: string
  fieldErrors?: Partial<Record<string, string>>
}

export type StripeRegisterResult =
  | { success: true; registrationId: string }
  | { success: false; error?: string; fieldErrors?: Partial<Record<string, string>> }

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_SIZE = 5 * 1024 * 1024

export async function submitRegistration(
  _prev: RegisterFormState,
  formData: FormData
): Promise<RegisterFormState> {
  const full_name = (formData.get('full_name') as string)?.trim()
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const phone = (formData.get('phone') as string)?.trim() || null
  const gms_church = formData.get('gms_church') as string
  const nij = (formData.get('nij') as string)?.trim() || null
  const package_id = formData.get('package_id') as string
  const event_id = formData.get('event_id') as string
  const file = formData.get('payment_screenshot')

  const fieldErrors: Record<string, string> = {}

  if (!(file instanceof File) || file.size === 0) {
    fieldErrors.payment_screenshot = 'Payment screenshot is required'
  } else if (file.size > MAX_FILE_SIZE) {
    fieldErrors.payment_screenshot = 'File must be under 5 MB'
  } else if (!ALLOWED_TYPES.includes(file.type)) {
    fieldErrors.payment_screenshot = 'Only JPG, PNG, or WebP images are accepted'
  }

  // ── Fetch event config (core_fields + custom_fields) ─────────
  const supabase = createServiceClient()

  const { data: eventData } = await supabase
    .from('events')
    .select(
      'custom_fields, core_fields, registration_open, early_bird_enabled, early_bird_auto_change, early_bird_end_date'
    )
    .eq('id', event_id)
    .single()

  // ── Core field validation (respects per-event config) ─────────
  const coreFields = resolveCoreFields((eventData as any)?.core_fields)
  const cf = Object.fromEntries(coreFields.map((f) => [f.key, f]))

  if (cf.full_name?.enabled && cf.full_name?.required && !full_name) {
    fieldErrors.full_name = `${cf.full_name.label} is required`
  }

  if (cf.email?.enabled) {
    if (cf.email.required && !email) {
      fieldErrors.email = `${cf.email.label} is required`
    } else if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      fieldErrors.email = 'Please enter a valid email address'
    }
  }

  if (cf.gms_church?.enabled && cf.gms_church?.required && !gms_church) {
    fieldErrors.gms_church = `Please select your ${cf.gms_church.label}`
  }

  if (cf.phone?.enabled && cf.phone?.required && !phone) {
    fieldErrors.phone = `${cf.phone.label} is required`
  }

  if (cf.nij?.enabled && cf.nij?.required && !nij) {
    fieldErrors.nij = `${cf.nij.label} is required`
  }

  if (!eventData?.registration_open) {
    return { error: 'Registration for this event is closed.' }
  }

  // Validate package_id only when the event has packages
  const { count: pkgCount } = await supabase
    .from('packages')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', event_id)

  if ((pkgCount ?? 0) > 0 && !package_id) {
    fieldErrors.package_id = 'Please select a package'
  }

  const customFields: CustomField[] = (eventData?.custom_fields ?? []) as CustomField[]
  const custom_answers: Record<string, string | boolean> = {}

  for (const field of customFields) {
    const key = `custom_${field.id}`
    if (field.type === 'checkbox') {
      custom_answers[field.id] = formData.get(key) === 'on'
      // checkboxes are not required in the traditional sense
    } else {
      const value = ((formData.get(key) as string) ?? '').trim()
      custom_answers[field.id] = value
      if (field.required && !value) {
        fieldErrors[key] = `${field.label} is required`
      }
    }
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors }

  // ── Duplicate email check (only when email was provided) ─────
  if (email) {
    const { data: existing } = await supabase
      .from('registrations')
      .select('id')
      .eq('event_id', event_id)
      .eq('email', email)
      .maybeSingle()

    if (existing) {
      return { fieldErrors: { email: 'This email is already registered for this event' } }
    }
  }

  // ── Resolve pricing (server-side; never trust client) ─────────
  let amount_paid: number | null = null
  let is_early_bird = false

  if (package_id) {
    const { data: pkg } = await supabase
      .from('packages')
      .select('price, early_bird_price')
      .eq('id', package_id)
      .eq('event_id', event_id)
      .single()

    if (!pkg) return { error: 'Invalid package selected.' }

    const pricing = resolveRegistrationPricing(pkg, eventData!)
    amount_paid = pricing.amount_paid
    is_early_bird = pricing.is_early_bird
  }

  // ── Insert registration ──────────────────────────────────────
  const { data: registration, error: insertError } = await supabase
    .from('registrations')
    .insert({
      event_id,
      full_name:      full_name  || null,
      email:          email      || null,
      phone:          phone      || null,
      gms_church:     gms_church || null,
      nij:            nij        || null,
      package_id:     package_id || null,
      payment_method: 'manual',
      payment_status: 'pending',
      custom_answers,
      amount_paid,
      is_early_bird,
    })
    .select('id, qr_token')
    .single()

  if (insertError || !registration) {
    if (insertError?.code === '23505') {
      return { fieldErrors: { email: 'This email is already registered for this event' } }
    }
    return { error: 'Registration failed. Please try again.' }
  }

  // ── Upload screenshot ────────────────────────────────────────
  if (!(file instanceof File)) {
    await supabase.from('registrations').delete().eq('id', registration.id)
    return { error: 'Failed to process file. Please try again.' }
  }

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const storagePath = `${event_id}/${registration.id}/payment.${ext}`
  const bytes = new Uint8Array(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, bytes, { contentType: file.type, upsert: false })

  if (uploadError) {
    console.error('[storage upload error]', uploadError)
    await supabase.from('registrations').delete().eq('id', registration.id)
    return { error: `Upload failed: ${uploadError.message}` }
  }

  await supabase
    .from('registrations')
    .update({ payment_screenshot_url: storagePath })
    .eq('id', registration.id)

  // ── Send confirmation email (non-fatal) ──────────────────────
  const { data: fullReg } = await supabase
    .from('registrations')
    .select(
      `full_name, email, gms_church, nij, qr_token, amount_paid, is_early_bird,
       packages(name, price, early_bird_price, toolkit_items),
       events(name, date, location, currency, early_bird_enabled, early_bird_auto_change, early_bird_end_date)`
    )
    .eq('id', registration.id)
    .single()

  if (fullReg?.email && fullReg?.packages && fullReg?.events) {
    try {
      const pkg = fullReg.packages as unknown as {
        name: string
        price: number
        early_bird_price: number | null
        toolkit_items: string[]
      }
      const evt = fullReg.events as unknown as {
        name: string
        date: string
        location: string
        currency: string
        early_bird_enabled: boolean
        early_bird_auto_change: boolean
        early_bird_end_date: string | null
      }
      await sendConfirmationEmail(
        {
          full_name: fullReg.full_name,
          email: fullReg.email,
          gms_church: fullReg.gms_church,
          nij: fullReg.nij,
          qr_token: fullReg.qr_token,
        },
        pkg,
        evt,
        {
          amount_paid: fullReg.amount_paid != null ? Number(fullReg.amount_paid) : Number(pkg.price),
          is_early_bird: fullReg.is_early_bird,
        }
      )
    } catch (emailErr) {
      console.error('[email error]', emailErr)
    }
  }

  redirect(`/register/success?id=${registration.id}`)
}

// ── Stripe: create pending registration before payment confirmation ──
export async function createStripeRegistration(
  formData: FormData
): Promise<StripeRegisterResult> {
  const full_name = (formData.get('full_name') as string)?.trim()
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const phone = (formData.get('phone') as string)?.trim() || null
  const gms_church = formData.get('gms_church') as string
  const nij = (formData.get('nij') as string)?.trim() || null
  const package_id = formData.get('package_id') as string
  const event_id = formData.get('event_id') as string
  const stripe_payment_intent_id = formData.get('stripe_payment_intent_id') as string

  if (!stripe_payment_intent_id)
    return { success: false, error: 'Payment not initialised. Please try again.' }

  const fieldErrors: Record<string, string> = {}
  if (!full_name) fieldErrors.full_name = 'Full name is required'
  if (!email) {
    fieldErrors.email = 'Email is required'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fieldErrors.email = 'Please enter a valid email address'
  }
  if (!gms_church) fieldErrors.gms_church = 'Please select your church branch'
  if (!package_id) fieldErrors.package_id = 'Please select a package'
  if (Object.keys(fieldErrors).length > 0) return { success: false, fieldErrors }

  const supabase = createServiceClient()

  const { data: existing } = await supabase
    .from('registrations')
    .select('id')
    .eq('event_id', event_id)
    .eq('email', email)
    .maybeSingle()

  if (existing)
    return { success: false, fieldErrors: { email: 'This email is already registered for this event' } }

  const { data: eventData } = await supabase
    .from('events')
    .select('early_bird_enabled, early_bird_auto_change, early_bird_end_date')
    .eq('id', event_id)
    .single()

  let amount_paid: number | null = null
  let is_early_bird = false

  if (package_id && eventData) {
    const { data: pkg } = await supabase
      .from('packages')
      .select('price, early_bird_price')
      .eq('id', package_id)
      .single()
    if (pkg) {
      const pricing = resolveRegistrationPricing(pkg, eventData)
      amount_paid = pricing.amount_paid
      is_early_bird = pricing.is_early_bird
    }
  }

  const { data: registration, error: insertError } = await supabase
    .from('registrations')
    .insert({
      event_id,
      full_name,
      email,
      phone,
      gms_church,
      nij: nij || null,
      package_id,
      payment_method: 'stripe',
      payment_status: 'pending',
      stripe_payment_intent_id,
      custom_answers: {},
      amount_paid,
      is_early_bird,
    })
    .select('id')
    .single()

  if (insertError || !registration) {
    if (insertError?.code === '23505')
      return { success: false, fieldErrors: { email: 'This email is already registered for this event' } }
    return { success: false, error: 'Registration failed. Please try again.' }
  }

  return { success: true, registrationId: registration.id }
}
