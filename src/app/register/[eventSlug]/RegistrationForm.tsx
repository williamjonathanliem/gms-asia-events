'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { useRef, useState } from 'react'
import { submitRegistration, type RegisterFormState } from './actions'
import { type Package } from '@/lib/types/database'
import type { EventWithPackages, CustomField } from '@/lib/types/database'
import { resolveCoreFields } from '@/lib/types/database'
import { resolveEventCurrency } from '@/lib/currencies'
import { CurrencyBanner, PackagePrice } from '@/components/registration/PackagePrice'
import { formatDate } from '@/lib/utils'
import { getEffectivePackagePrice, isEarlyBirdPricingActive } from '@/lib/pricing'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'

// ── Submit button with pending state ──────────────────────────
function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full mt-2">
      {pending ? (
        <span className="flex items-center gap-2">
          <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Submitting…
        </span>
      ) : (
        'Register Now'
      )}
    </Button>
  )
}

// ── Field error helper ─────────────────────────────────────────
function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1.5 text-xs text-error">{message}</p>
}

// ── Dynamic custom field renderer ────────────────────────────
function CustomFieldInput({
  field,
  error,
}: {
  field: CustomField
  error?: string
}) {
  const inputId = `custom_${field.id}`

  return (
    <div>
      <Label htmlFor={inputId} required={field.required}>
        {field.label}
      </Label>

      {field.type === 'text' && (
        <Input
          id={inputId}
          name={inputId}
          placeholder={field.placeholder}
          className={error ? 'border-error' : ''}
        />
      )}

      {field.type === 'textarea' && (
        <textarea
          id={inputId}
          name={inputId}
          placeholder={field.placeholder}
          rows={3}
          className={cn(
            'w-full rounded-btn border border-[#E5E5E5] bg-white px-3 py-2 text-sm text-[#111111] placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[#111111] focus:border-transparent resize-none',
            error ? 'border-error' : ''
          )}
        />
      )}

      {field.type === 'select' && (
        <Select
          id={inputId}
          name={inputId}
          defaultValue=""
          className={error ? 'border-error' : ''}
        >
          <option value="" disabled>Select an option</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </Select>
      )}

      {field.type === 'checkbox' && (
        <label className="mt-2 flex cursor-pointer items-center gap-3">
          <input
            id={inputId}
            name={inputId}
            type="checkbox"
            className="size-4 rounded border-[#E5E5E5] accent-[#111111]"
          />
          <span className="text-sm text-[#111111]">{field.label}</span>
        </label>
      )}

      <FieldError message={error} />
    </div>
  )
}

// ── Core field renderer ───────────────────────────────────────
function CoreFieldInput({
  field,
  fieldName,
  error,
  defaultOptions,
}: {
  field: ReturnType<typeof resolveCoreFields>[number]
  fieldName: string
  error?: string
  defaultOptions?: string[]
}) {
  const options = field.inputType === 'select'
    ? (field.options?.length ? field.options : defaultOptions ?? [])
    : []

  return (
    <div>
      <Label htmlFor={fieldName} required={field.required}>
        {field.label}
        {!field.required && <span className="font-normal text-muted">&ensp;(optional)</span>}
      </Label>

      {field.inputType === 'textarea' ? (
        <textarea
          id={fieldName}
          name={fieldName}
          rows={3}
          className={cn(
            'w-full rounded-btn border border-[#E5E5E5] bg-white px-3 py-2 text-sm text-[#111111] placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[#111111] focus:border-transparent resize-none',
            error ? 'border-error' : ''
          )}
        />
      ) : field.inputType === 'select' ? (
        <Select id={fieldName} name={fieldName} defaultValue="" className={error ? 'border-error' : ''}>
          <option value="" disabled>Select an option</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </Select>
      ) : (
        <Input
          id={fieldName}
          name={fieldName}
          type={field.inputType}
          className={error ? 'border-error' : ''}
        />
      )}

      <FieldError message={error} />
    </div>
  )
}

// ── Main form ─────────────────────────────────────────────────
interface Props {
  event: EventWithPackages
  packages: Package[]
  globalChurches: string[]
}

const initial: RegisterFormState = {}

export default function RegistrationForm({ event, packages, globalChurches }: Props) {
  const [state, action] = useFormState(submitRegistration, initial)
  const [selectedPkg, setSelectedPkg] = useState<string>(packages[0]?.id ?? '')
  const [fileName, setFileName] = useState<string>('')
  const fileRef = useRef<HTMLInputElement>(null)

  const fe = state.fieldErrors ?? {}
  const customFields: CustomField[] = event.custom_fields ?? []
  const coreFields = resolveCoreFields(event.core_fields)
  const cf = Object.fromEntries(coreFields.map((f) => [f.key, f]))

  const headingText = event.form_title || event.name
  const subtitleText = event.form_subtitle
  const earlyBirdActive = isEarlyBirdPricingActive(event)
  const currency = resolveEventCurrency(event.currency)

  const selectedPackage = packages.find((p) => p.id === selectedPkg)
  const amountDue = selectedPackage
    ? getEffectivePackagePrice(selectedPackage, event)
    : null

  return (
    <div className="min-h-screen bg-white">
      {/* ── Page header ── */}
      <div className="border-b border-[#E5E5E5]">
        <div className="mx-auto max-w-xl px-4 py-8 sm:px-6 sm:py-10">
          <p className="text-xs font-medium uppercase tracking-widest text-muted">
            Event Registration
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-[#111111]">{headingText}</h1>
          {subtitleText ? (
            <p className="mt-2 text-sm text-muted whitespace-pre-line">{subtitleText}</p>
          ) : (
            <p className="mt-1 text-sm text-muted">
              {formatDate(event.date)}&ensp;·&ensp;{event.location}
            </p>
          )}
        </div>
      </div>

      <form action={action} className="mx-auto max-w-xl space-y-8 px-4 py-8 sm:space-y-10 sm:px-6 sm:py-10">
        {/* Global error */}
        {state.error && (
          <div className="rounded-lg border border-error/30 bg-error/5 px-4 py-3 text-sm text-error">
            {state.error}
          </div>
        )}

        {/* ── Section: Personal Information ── */}
        {(cf.full_name?.enabled || cf.email?.enabled || cf.phone?.enabled) && (
          <section className="space-y-5">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-[#111111]">
              Personal Information
            </h2>
            {cf.full_name?.enabled && (
              <CoreFieldInput field={cf.full_name} fieldName="full_name" error={fe.full_name} />
            )}
            {cf.email?.enabled && (
              <CoreFieldInput field={cf.email} fieldName="email" error={fe.email} />
            )}
            {cf.phone?.enabled && (
              <CoreFieldInput field={cf.phone} fieldName="phone" error={fe.phone} />
            )}
          </section>
        )}

        {/* ── Section: Church Information ── */}
        {(cf.gms_church?.enabled || cf.nij?.enabled) && (
          <section className="space-y-5">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-[#111111]">
              Church Information
            </h2>
            {cf.gms_church?.enabled && (
              <CoreFieldInput
                field={cf.gms_church}
                fieldName="gms_church"
                error={fe.gms_church}
                defaultOptions={globalChurches}
              />
            )}
            {cf.nij?.enabled && (
              <CoreFieldInput field={cf.nij} fieldName="nij" error={fe.nij} />
            )}
          </section>
        )}

        {/* ── Section: Custom Fields ── */}
        {customFields.length > 0 && (
          <section className="space-y-5">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-[#111111]">
              Additional Information
            </h2>
            {customFields.map((field) => (
              <CustomFieldInput
                key={field.id}
                field={field}
                error={fe[`custom_${field.id}`]}
              />
            ))}
          </section>
        )}

        {/* ── Section: Package Selection (hidden when event has no packages) ── */}
        {packages.length > 0 && <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-[#111111]">
              Package
            </h2>
            <span className="rounded-full border border-[#E5E5E5] bg-[#fafafa] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#111111]">
              {currency}
            </span>
            {earlyBirdActive && (
              <span className="rounded-full bg-[#111111] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                Early bird
              </span>
            )}
          </div>
          <CurrencyBanner currency={currency} />
          {earlyBirdActive && event.early_bird_end_date && (
            <p className="text-xs text-muted">
              Early bird pricing until {formatDate(event.early_bird_end_date)} (inclusive).
            </p>
          )}
          <FieldError message={fe.package_id} />

          <div className="space-y-3">
            {packages.map((pkg) => {
              const isSelected = selectedPkg === pkg.id
              const effectivePrice = getEffectivePackagePrice(pkg, event)
              const showEarlyBird =
                earlyBirdActive &&
                pkg.early_bird_price != null &&
                effectivePrice < pkg.price
              return (
                <label
                  key={pkg.id}
                  className={cn(
                    'flex cursor-pointer gap-4 rounded-lg border-2 p-4 transition-colors',
                    isSelected
                      ? 'border-[#111111] bg-[#fafafa]'
                      : 'border-[#E5E5E5] hover:border-[#999999]'
                  )}
                >
                  <input
                    type="radio"
                    name="package_id"
                    value={pkg.id}
                    checked={isSelected}
                    onChange={() => setSelectedPkg(pkg.id)}
                    className="sr-only"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-semibold text-[#111111]">
                        {pkg.name}
                      </span>
                      <PackagePrice
                        amount={effectivePrice}
                        currency={currency}
                        compareAt={showEarlyBird ? pkg.price : null}
                        className="shrink-0"
                      />
                    </div>
                    <ul className="mt-2.5 space-y-1.5">
                      {pkg.toolkit_items.map((item, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-muted">
                          <span className="size-1 shrink-0 rounded-full bg-muted" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Radio indicator */}
                  <div
                    className={cn(
                      'mt-0.5 size-4 shrink-0 rounded-full border-2 flex items-center justify-center',
                      isSelected ? 'border-[#111111]' : 'border-[#D1D1D1]'
                    )}
                  >
                    {isSelected && (
                      <div className="size-2 rounded-full bg-[#111111]" />
                    )}
                  </div>
                </label>
              )
            })}
          </div>
        </section>}

        {/* ── Section: Payment Screenshot ── */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-[#111111]">
              Payment Proof
            </h2>
            {amountDue != null && selectedPackage && (
              <div className="mt-3 flex items-center justify-between gap-4 rounded-lg border-2 border-[#111111] bg-[#fafafa] px-4 py-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-widest text-muted">
                    Amount to pay
                  </p>
                  <p className="mt-0.5 text-sm text-[#111111]">
                    Package {selectedPackage.name}
                  </p>
                </div>
                <PackagePrice amount={amountDue} currency={currency} />
              </div>
            )}
            <p className="mt-3 text-sm text-muted">
              Upload a screenshot of your bank transfer for the exact amount above in{' '}
              <strong className="text-[#111111]">{currency}</strong> — JPG, PNG, or WebP, max 5 MB.
            </p>
          </div>

          <FieldError message={fe.payment_screenshot} />

          {/* Drop zone */}
          <label
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center gap-2.5 rounded-lg border-2 border-dashed px-6 py-10 transition-colors',
              fileName
                ? 'border-[#111111] bg-[#fafafa]'
                : fe.payment_screenshot
                ? 'border-error/40 bg-error/5'
                : 'border-[#E5E5E5] hover:border-[#999999]'
            )}
          >
            <input
              ref={fileRef}
              type="file"
              name="payment_screenshot"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')}
            />

            {fileName ? (
              <>
                <svg className="size-6 text-[#111111]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                <span className="max-w-full break-all text-center text-sm font-medium text-[#111111]">
                  {fileName}
                </span>
                <span className="text-xs text-muted">Click to change</span>
              </>
            ) : (
              <>
                <svg className="size-6 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <span className="text-sm font-medium text-[#111111]">Click to upload</span>
                <span className="text-xs text-muted">JPG · PNG · WebP · max 5 MB</span>
              </>
            )}
          </label>
        </section>

        {/* Hidden inputs */}
        <input type="hidden" name="event_id" value={event.id} />

        <SubmitButton />
      </form>
    </div>
  )
}
