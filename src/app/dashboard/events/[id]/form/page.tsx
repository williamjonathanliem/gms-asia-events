import { createClient } from '@/lib/supabase/server'
import { getCurrentStaffUser } from '@/lib/supabase/auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import FormEditor from '@/components/dashboard/events/FormEditor'
import { getGlobalChurches } from '@/app/dashboard/settings/actions'
import type { Metadata } from 'next'
import type { EventWithPackages } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Edit Form' }

export default async function FormEditorPage({ params }: { params: { id: string } }) {
  const staff = await getCurrentStaffUser()
  if (!staff || !['super_admin', 'admin'].includes(staff.role)) redirect('/dashboard')

  const supabase = createClient()
  const [{ data }, globalChurches] = await Promise.all([
    supabase.from('events').select('*, packages(*)').eq('id', params.id).single(),
    getGlobalChurches(),
  ])

  if (!data) notFound()

  const event = data as unknown as EventWithPackages

  return (
    <div className="min-h-screen">
      <div className="sticky top-14 lg:top-0 z-10 bg-white border-b border-[#E5E5E5] px-4 py-4 sm:px-8 sm:py-5">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/events"
            className="flex items-center gap-1.5 text-sm text-muted hover:text-[#111111] transition-colors"
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Events
          </Link>
          <span className="text-muted">/</span>
          <span className="text-sm text-muted">{event.name}</span>
          <span className="text-muted">/</span>
          <span className="text-sm font-medium text-[#111111]">Form</span>
        </div>
      </div>
      <div className="px-4 py-5 sm:px-8 sm:py-6">
        <FormEditor event={event} globalChurches={globalChurches} />
      </div>
    </div>
  )
}
