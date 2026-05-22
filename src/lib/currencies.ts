/** Currencies available when configuring an event for registration */
export const EVENT_CURRENCIES = [
  { code: 'IDR', label: 'Indonesian Rupiah (IDR)', locale: 'id-ID', decimals: 0 },
  { code: 'SGD', label: 'Singapore Dollar (SGD)', locale: 'en-SG', decimals: 2 },
  { code: 'MYR', label: 'Malaysian Ringgit (MYR)', locale: 'ms-MY', decimals: 2 },
  { code: 'HKD', label: 'Hong Kong Dollar (HKD)', locale: 'en-HK', decimals: 2 },
  { code: 'TWD', label: 'New Taiwan Dollar (TWD)', locale: 'zh-TW', decimals: 0 },
  { code: 'JPY', label: 'Japanese Yen (JPY)', locale: 'ja-JP', decimals: 0 },
  { code: 'USD', label: 'US Dollar (USD)', locale: 'en-US', decimals: 2 },
  { code: 'PHP', label: 'Philippine Peso (PHP)', locale: 'en-PH', decimals: 2 },
] as const

export type EventCurrency = (typeof EVENT_CURRENCIES)[number]['code']

export const DEFAULT_EVENT_CURRENCY: EventCurrency = 'IDR'

export function isValidEventCurrency(code: string): code is EventCurrency {
  return EVENT_CURRENCIES.some((c) => c.code === code)
}

export function getCurrencyConfig(code: string) {
  return (
    EVENT_CURRENCIES.find((c) => c.code === code) ??
    EVENT_CURRENCIES.find((c) => c.code === DEFAULT_EVENT_CURRENCY)!
  )
}

/** Human-readable label for forms, e.g. "Singapore Dollar (SGD)" */
export function getCurrencyLabel(code: string): string {
  return getCurrencyConfig(code).label
}

export function resolveEventCurrency(currency: string | null | undefined): string {
  if (currency && isValidEventCurrency(currency)) return currency
  return DEFAULT_EVENT_CURRENCY
}
