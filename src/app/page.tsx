import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function RootPage() {
  const supabase = createClient()

  const { data: event } = await supabase
    .from('events')
    .select('slug')
    .eq('is_active', true)
    .single()

  if (event?.slug) {
    redirect(`/register/${event.slug}`)
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-muted">No active event at this time.</p>
    </main>
  )
}
