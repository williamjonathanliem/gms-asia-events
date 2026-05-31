import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/server'
import { sendVerifiedEmail } from '@/lib/email'
import type Stripe from 'stripe'

// Tell Next.js not to parse the body — Stripe needs the raw bytes to verify signature
export const config = { api: { bodyParser: false } }

export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    const rawBody = await req.arrayBuffer()

    if (process.env.NODE_ENV === 'development' && webhookSecret === 'skip') {
      // Dev shortcut: parse without verifying (only when explicitly set to 'skip')
      event = JSON.parse(Buffer.from(rawBody).toString('utf8')) as Stripe.Event
    } else {
      event = stripe.webhooks.constructEvent(
        Buffer.from(rawBody),
        sig,
        webhookSecret
      )
    }
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 })
  }

  // ── Handle events ────────────────────────────────────────────
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent
    const supabase = createServiceClient()

    // Find the registration that was waiting for this PaymentIntent
    const { data: registration, error } = await supabase
      .from('registrations')
      .select('id, payment_status')
      .eq('stripe_payment_intent_id', paymentIntent.id)
      .maybeSingle()

    if (error) {
      console.error('[webhook] DB error looking up registration:', error)
      // Return 200 so Stripe doesn't retry — the registration may not exist yet
      return NextResponse.json({ received: true })
    }

    if (registration && registration.payment_status !== 'verified') {
      const { error: updateError } = await supabase
        .from('registrations')
        .update({ payment_status: 'verified' })
        .eq('id', registration.id)

      if (updateError) {
        console.error('[webhook] Failed to auto-verify registration:', updateError)
      } else {
        console.log(`[webhook] Auto-verified registration ${registration.id}`)

        // Send verified email with QR code
        try {
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
            const pkg = fullReg.packages as unknown as {
              name: string; price: number; early_bird_price: number | null; toolkit_items: string[]
            }
            const evt = fullReg.events as unknown as {
              name: string; date: string; location: string; currency: string
              early_bird_enabled: boolean; early_bird_auto_change: boolean; early_bird_end_date: string | null
            }
            await sendVerifiedEmail(
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
          }
        } catch (emailErr) {
          console.error('[webhook] Failed to send verified email:', emailErr)
        }
      }
    }
  }

  return NextResponse.json({ received: true })
}
