import { redirect } from 'next/navigation'
import { getCurrentStaffUser } from '@/lib/supabase/auth'
import Sidebar from '@/components/dashboard/Sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const staff = await getCurrentStaffUser()
  if (!staff) redirect('/auth/login')

  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar staff={staff} />
      <div className="flex-1 pl-64">
        {children}
      </div>
    </div>
  )
}
