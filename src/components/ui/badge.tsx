import { cn } from '@/lib/utils'
import type { PaymentStatus } from '@/lib/types/database'

const styles: Record<PaymentStatus, string> = {
  pending: 'border-warning text-warning',
  verified: 'border-success text-success',
  rejected: 'border-error text-error',
}

const labels: Record<PaymentStatus, string> = {
  pending: 'Pending',
  verified: 'Verified',
  rejected: 'Rejected',
}

export function StatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <span className={cn('badge', styles[status])}>
      {labels[status]}
    </span>
  )
}
