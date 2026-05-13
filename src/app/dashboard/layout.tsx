import { redirect } from 'next/navigation'
import { getCurrentStaffUser } from '@/lib/supabase/auth'
import Sidebar from '@/components/dashboard/Sidebar'
import DashboardShell from '@/components/dashboard/DashboardShell'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const staff = await getCurrentStaffUser()
  if (!staff) redirect('/auth/login')

  return (
    <DashboardShell sidebar={<Sidebar staff={staff} />}>
      {children}
    </DashboardShell>
  )
}
