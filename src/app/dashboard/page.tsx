import { redirect } from 'next/navigation'
import { getCurrentStaffUser } from '@/lib/supabase/auth'

export default async function DashboardPage() {
  const staff = await getCurrentStaffUser()

  // Scanners go straight to the scanner — they have no use for the dashboard
  if (!staff || staff.role === 'scanner') {
    redirect('/dashboard/scanner')
  }

  redirect('/dashboard/registrations')
}
