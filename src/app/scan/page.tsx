import { redirect } from 'next/navigation'
import { getCurrentStaffUser } from '@/lib/supabase/auth'
import dynamic from 'next/dynamic'

const QRScanner = dynamic(() => import('@/components/scanner/QRScanner'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <svg className="size-8 animate-spin text-white/40" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
    </div>
  ),
})

export default async function ScanPage() {
  const staff = await getCurrentStaffUser()

  if (!staff || !['super_admin', 'admin', 'scanner'].includes(staff.role)) {
    redirect('/dashboard')
  }

  return <QRScanner />
}
