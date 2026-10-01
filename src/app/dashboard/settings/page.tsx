import { getCurrentStaffUser } from '@/lib/supabase/auth'
import { redirect } from 'next/navigation'
import { getGlobalChurches } from './actions'
import SettingsClient from '@/components/dashboard/settings/SettingsClient'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const staff = await getCurrentStaffUser()
  if (staff?.role !== 'super_admin') redirect('/dashboard')

  const churches = await getGlobalChurches()

  return (
    <div className="min-h-screen">
      <div className="sticky top-14 lg:top-0 z-10 bg-white border-b border-[#E5E5E5] px-4 py-4 sm:px-8 sm:py-5">
        <h1 className="text-xl font-semibold text-[#111111]">Church Branches</h1>
        <p className="mt-1 text-sm text-muted">Manage the church branch options shown on registration forms</p>
      </div>
      <div className="px-6 py-8 sm:px-10">
        <SettingsClient initialChurches={churches} />
      </div>
    </div>
  )
}
