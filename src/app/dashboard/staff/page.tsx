import { createClient } from '@/lib/supabase/server'
import { getCurrentStaffUser } from '@/lib/supabase/auth'
import { redirect } from 'next/navigation'
import StaffClient from '@/components/dashboard/staff/StaffClient'
import type { Metadata } from 'next'
import type { StaffUser, Event } from '@/lib/types/database'

export const metadata: Metadata = { title: 'Staff' }

export default async function StaffPage() {
  const staff = await getCurrentStaffUser()
  if (staff?.role !== 'super_admin') redirect('/dashboard')

  const supabase = createClient()

  const [{ data: staffList }, { data: events }] = await Promise.all([
    supabase
      .from('staff_users')
      .select('*')
      .order('created_at', { ascending: true }),
    supabase
      .from('events')
      .select('id, name, date')
      .order('date', { ascending: false }),
  ])

  return (
    <div className="min-h-screen">
      <div className="sticky top-14 lg:top-0 z-10 bg-white border-b border-[#E5E5E5] px-4 py-4 sm:px-8 sm:py-5">
        <h1 className="text-xl font-semibold text-[#111111]">Staff</h1>
        <p className="mt-1 text-sm text-muted">
          Invite staff members and manage their roles and event access
        </p>
      </div>
      <div className="px-4 py-5 sm:px-8 sm:py-6">
        <StaffClient
          initialStaff={(staffList ?? []) as StaffUser[]}
          events={(events ?? []) as Pick<Event, 'id' | 'name' | 'date'>[]}
          currentUserId={staff.id}
        />
      </div>
    </div>
  )
}
