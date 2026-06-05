import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { getCurrencyConfig } from '@/lib/currencies'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'IDR'): string {
  const { locale, code, decimals } = getCurrencyConfig(currency)
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: code,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount)
}

export function formatJPY(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/** Formats a single date or a date range.
 *  Same month:  "24–26 October 2026"
 *  Diff month:  "30 October – 2 November 2026"
 *  Diff year:   "31 December 2026 – 2 January 2027"
 *  No end date: "24 October 2026"
 */
export function formatDateRange(start: string, end: string | null | undefined): string {
  const s = new Date(start)
  if (!end) return formatDate(start)
  const e = new Date(end)
  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
    // Same month — share month+year on the end
    return `${s.getDate()}–${e.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`
  }
  if (s.getFullYear() === e.getFullYear()) {
    // Same year, different months
    return `${s.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })} – ${e.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`
  }
  // Different years
  return `${formatDate(start)} – ${formatDate(end)}`
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
