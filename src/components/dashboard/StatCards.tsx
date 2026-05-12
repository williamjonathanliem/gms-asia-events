import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: number
  sub?: string
}

function Card({ label, value, sub }: StatCardProps) {
  return (
    <div className="rounded-lg border border-[#E5E5E5] px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-[#111111]">{value.toLocaleString()}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  )
}

interface Props {
  eventId: string
  totalRegistrations?: number
}

export default async function StatCards({ eventId }: Props) {
  const supabase = createClient()

  const [
    { count: total },
    { count: verified },
    { count: pending },
    { count: toolkit },
    { count: attended },
  ] = await Promise.all([
    supabase
      .from('registrations')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId),
    supabase
      .from('registrations')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('payment_status', 'verified'),
    supabase
      .from('registrations')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('payment_status', 'pending'),
    supabase
      .from('attendance_logs')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('scan_type', 'toolkit'),
    supabase
      .from('attendance_logs')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('scan_type', 'event'),
  ])

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Card label="Total Registered" value={total ?? 0} sub={`${pending ?? 0} pending payment`} />
      <Card label="Payment Verified" value={verified ?? 0} />
      <Card label="Toolkit Collected" value={toolkit ?? 0} />
      <Card label="Event Attended" value={attended ?? 0} />
    </div>
  )
}
