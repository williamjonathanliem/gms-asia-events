import { getCurrentStaffUser } from '@/lib/supabase/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getEmailBlasts } from './actions'
import { getGlobalChurches } from '@/app/dashboard/settings/actions'
import BlastClient from '@/components/dashboard/blast/BlastClient'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Announcements' }

export default async function BlastPage() {
  const staff = await getCurrentStaffUser()
  if (!staff || !['super_admin', 'admin'].includes(staff.role)) {
    redirect('/dashboard')
  }

  const supabase = createServiceClient()

  const [
    { data: eventsData },
    { data: packagesData },
    { data: contactsData },
    churches,
    blasts,
  ] = await Promise.all([
    supabase.from('events').select('id, name, date').order('date', { ascending: false }),
    supabase.from('packages').select('id, name, event_id').order('name'),
    supabase.from('registrations').select('full_name, email, gms_church, payment_status, events(name)').order('full_name'),
    getGlobalChurches(),
    getEmailBlasts(),
  ])

  const allContacts = (contactsData ?? []).map((r: any) => ({
    full_name:      r.full_name as string,
    email:          r.email as string,
    gms_church:     r.gms_church as string,
    payment_status: r.payment_status as string,
    event_name:     (r.events?.name ?? '') as string,
  }))

  return (
    <div className="min-h-screen">
      <div className="sticky top-14 lg:top-0 z-10 bg-white border-b border-[#E5E5E5] px-4 py-4 sm:px-8 sm:py-5">
        <h1 className="text-xl font-semibold text-[#111111]">Announcements</h1>
        <p className="mt-1 text-sm text-muted">
          Send email blasts to registrants across any event
        </p>
      </div>
      <div className="mx-auto max-w-2xl px-4 py-5 sm:px-8 sm:py-6">
        <BlastClient
          events={eventsData ?? []}
          packages={packagesData ?? []}
          churches={churches}
          initialBlasts={blasts}
          allContacts={allContacts}
        />
      </div>
    </div>
  )
}
