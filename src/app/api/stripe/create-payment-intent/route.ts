import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/server'
import { stripeGrossAmount, stripeFeeAmount } from '@/lib/constants'

export async function POST(req: NextRequest) {
  try {
    const { package_id } = await req.json()

    if (!package_id) {
      return NextResponse.json({ error: 'package_id is required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const { data: pkg, error } = await supabase
      .from('packages')
      .select('id, name, stripe_price_jpy')
      .eq('id', package_id)
      .single()

    if (error || !pkg) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 })
    }

    if (!pkg.stripe_price_jpy || pkg.stripe_price_jpy <= 0) {
      return NextResponse.json(
        { error: 'Online payment is not configured for this package. Please contact the organizer.' },
        { status: 422 }
      )
    }

    // stripe_price_jpy = NET amount organizer wants to receive (e.g. ¥3,500)
    // We gross up so after Stripe's fee, organizer nets exactly that amount
    const netAmount   = pkg.stripe_price_jpy
    const grossAmount = stripeGrossAmount(netAmount)
    const fee         = stripeFeeAmount(netAmount)

    // JPY is zero-decimal — amount is in yen, not sen
    const paymentIntent = await stripe.paymentIntents.create({
      amount: grossAmount,
      currency: 'jpy',
      automatic_payment_methods: { enabled: true },
      metadata: {
        package_id: pkg.id,
        package_name: pkg.name,
        net_amount_jpy: String(netAmount),
      },
    })

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      netAmount,
      fee,
      totalAmount: grossAmount,
    })
  } catch (err) {
    console.error('[create-payment-intent]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
