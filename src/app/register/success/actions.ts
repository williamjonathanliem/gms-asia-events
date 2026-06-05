'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { STORAGE_BUCKET } from '@/lib/constants'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_SIZE = 5 * 1024 * 1024

export async function uploadStripeProof(
  registrationId: string,
  formData: FormData
): Promise<{ error?: string }> {
  const file = formData.get('proof_screenshot')

  if (!(file instanceof File) || file.size === 0) return { error: 'Please select a file.' }
  if (file.size > MAX_FILE_SIZE) return { error: 'File must be under 5 MB.' }
  if (!ALLOWED_TYPES.includes(file.type)) return { error: 'Only JPG, PNG, or WebP accepted.' }

  const supabase = createServiceClient()

  const { data: reg } = await supabase
    .from('registrations')
    .select('id, event_id, payment_method, payment_screenshot_url')
    .eq('id', registrationId)
    .single()

  if (!reg) return { error: 'Registration not found.' }
  if (reg.payment_method !== 'stripe') return { error: 'This upload is only for card payments.' }
  if (reg.payment_screenshot_url) return { error: 'Proof has already been uploaded.' }

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const storagePath = `${reg.event_id}/${registrationId}/payment.${ext}`
  const bytes = new Uint8Array(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, bytes, { contentType: file.type, upsert: false })

  if (uploadError) return { error: `Upload failed: ${uploadError.message}` }

  await supabase
    .from('registrations')
    .update({ payment_screenshot_url: storagePath })
    .eq('id', registrationId)

  return {}
}
