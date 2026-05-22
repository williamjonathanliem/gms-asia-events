import type { Event, Package } from '@/lib/types/database'

/** Today as YYYY-MM-DD (UTC) for date comparison */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Whether early bird pricing applies right now.
 * - Disabled when early_bird_enabled is false.
 * - When auto_change is off, enabled flag alone controls pricing (manual off via toggle).
 * - When auto_change is on, pricing applies through early_bird_end_date (inclusive).
 */
export function isEarlyBirdPricingActive(
  event: Pick<Event, 'early_bird_enabled' | 'early_bird_auto_change' | 'early_bird_end_date'>
): boolean {
  if (!event.early_bird_enabled) return false
  if (!event.early_bird_auto_change) return true
  if (!event.early_bird_end_date) return false
  return todayUtc() <= event.early_bird_end_date
}

export function getEffectivePackagePrice(
  pkg: Pick<Package, 'price' | 'early_bird_price'>,
  event: Pick<Event, 'early_bird_enabled' | 'early_bird_auto_change' | 'early_bird_end_date'>
): number {
  if (
    isEarlyBirdPricingActive(event) &&
    pkg.early_bird_price != null &&
    pkg.early_bird_price >= 0
  ) {
    return Number(pkg.early_bird_price)
  }
  return Number(pkg.price)
}

/** Resolve price + early bird flag when creating a registration */
export function resolveRegistrationPricing(
  pkg: Pick<Package, 'price' | 'early_bird_price'>,
  event: Pick<Event, 'early_bird_enabled' | 'early_bird_auto_change' | 'early_bird_end_date'>
): { amount_paid: number; is_early_bird: boolean } {
  const amount_paid = getEffectivePackagePrice(pkg, event)
  const is_early_bird =
    isEarlyBirdPricingActive(event) &&
    pkg.early_bird_price != null &&
    amount_paid === Number(pkg.early_bird_price)
  return { amount_paid, is_early_bird }
}
