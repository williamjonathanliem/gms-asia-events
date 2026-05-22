import { getCurrencyLabel } from '@/lib/currencies'
import { formatCurrency, cn } from '@/lib/utils'

interface Props {
  amount: number
  currency: string
  compareAt?: number | null
  size?: 'sm' | 'md'
  className?: string
}

/** Package price with explicit currency code for registration forms */
export function PackagePrice({
  amount,
  currency,
  compareAt,
  size = 'md',
  className,
}: Props) {
  const showCompare = compareAt != null && compareAt > amount

  return (
    <span className={cn('inline-flex flex-col items-end gap-0.5', className)}>
      {showCompare && (
        <span
          className={cn(
            'text-muted line-through',
            size === 'sm' ? 'text-xs' : 'text-sm'
          )}
        >
          {formatCurrency(compareAt, currency)}
        </span>
      )}
      <span className="inline-flex items-baseline gap-1.5">
        <span
          className={cn(
            'font-semibold text-[#111111]',
            size === 'sm' ? 'text-sm' : 'text-base'
          )}
        >
          {formatCurrency(amount, currency)}
        </span>
        <span className="rounded border border-[#E5E5E5] bg-[#fafafa] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
          {currency}
        </span>
      </span>
    </span>
  )
}

interface BannerProps {
  currency: string
  className?: string
}

export function CurrencyBanner({ currency, className }: BannerProps) {
  return (
    <p
      className={cn(
        'rounded-lg border border-[#E5E5E5] bg-[#fafafa] px-3 py-2 text-xs text-muted',
        className
      )}
    >
      All package prices and your payment are in{' '}
      <strong className="font-medium text-[#111111]">{currency}</strong>
      {' '}
      <span className="text-muted">({getCurrencyLabel(currency)})</span>
    </p>
  )
}
