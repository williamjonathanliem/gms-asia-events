import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import RegistrationForm from './RegistrationForm'
import { formatDate } from '@/lib/utils'
import type { Metadata } from 'next'
import type { EventWithPackages } from '@/lib/types/database'

interface Props {
  params: { eventSlug: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = createClient()
  const { data: event } = await supabase
    .from('events')
    .select('name, form_title')
    .eq('slug', params.eventSlug)
    .eq('is_active', true)
    .single()

  const title = event?.form_title || event?.name
  return { title: title ? `Register — ${title}` : 'Register' }
}

export default async function RegisterPage({ params }: Props) {
  const supabase = createClient()

  const { data: event } = await supabase
    .from('events')
    .select(
      '*, currency, early_bird_enabled, early_bird_auto_change, early_bird_end_date, core_fields'
    )
    .eq('slug', params.eventSlug)
    .eq('is_active', true)
    .single()

  if (!event) notFound()

  // Registration closed
  if (!event.registration_open) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6">
        <div className="max-w-sm text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">
            {event.form_title || event.name}
          </p>
          <h1 className="mt-3 text-2xl font-semibold text-[#111111]">
            Registration Closed
          </h1>
          <p className="mt-2 text-sm text-muted">
            Registration for this event is no longer open.
            Contact the organiser if you believe this is an error.
          </p>
          <p className="mt-4 text-xs text-muted">{formatDate(event.date)}</p>
        </div>
      </div>
    )
  }

  const { data: packages } = await supabase
    .from('packages')
    .select('*')
    .eq('event_id', event.id)
    .order('price', { ascending: false })

  return (
    <RegistrationForm
      event={event as unknown as EventWithPackages}
      packages={packages ?? []}
    />
  )
}
