export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getCurrentStaffUser } from '@/lib/supabase/auth'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/dashboard/Sidebar'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { formatDate } from '@/lib/utils'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const staff = await getCurrentStaffUser()
  if (!staff) redirect('/auth/login')

  const supabase = createClient()
  const { data: activeEvents } = await supabase
    .from('events')
    .select('id, name, date')
    .eq('is_active', true)
    .order('date', { ascending: false })

  const events = (activeEvents ?? []) as { id: string; name: string; date: string }[]

  return (
    <DashboardShell
      sidebar={<Sidebar staff={staff} activeEvents={events} />}
      activeEvents={events}
    >
      {children}
    </DashboardShell>
  )
}
