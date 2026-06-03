'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { updateEvent } from '@/app/dashboard/events/actions'
import CoreFieldsEditor from './CoreFieldsEditor'
import CustomFieldsBuilder from './CustomFieldsBuilder'
import { getBackgroundCSS } from '@/components/registration/FormBackground'
import { resolveTheme, isColorDark, DEFAULT_FORM_THEME } from '@/lib/types/database'
import { uploadEventBanner } from '@/app/dashboard/events/actions'
import type {
  EventWithPackages, CoreField, CustomField, FormTheme,
  FormBgType, FormCardStyle, FormButtonShape, FormInputStyle, FormFontFamily,
} from '@/lib/types/database'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type Tab = 'fields' | 'theme'

// ── Option tables ─────────────────────────────────────────────

const FONT_OPTIONS: { key: FormFontFamily; label: string; css: string; url: string | null }[] = [
  { key: 'geist',      label: 'Geist',      css: '"Geist", system-ui, sans-serif',         url: null },
  { key: 'inter',      label: 'Inter',      css: '"Inter", system-ui, sans-serif',          url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap' },
  { key: 'poppins',    label: 'Poppins',    css: '"Poppins", system-ui, sans-serif',        url: 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap' },
  { key: 'raleway',    label: 'Raleway',    css: '"Raleway", system-ui, sans-serif',        url: 'https://fonts.googleapis.com/css2?family=Raleway:wght@400;500;600&display=swap' },
  { key: 'playfair',   label: 'Playfair',   css: '"Playfair Display", Georgia, serif',      url: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600&display=swap' },
  { key: 'montserrat', label: 'Montserrat', css: '"Montserrat", system-ui, sans-serif',     url: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600&display=swap' },
]

const BG_TYPES: { key: FormBgType; label: string; desc: string }[] = [
  { key: 'solid',    label: 'Solid',    desc: 'Flat colour' },
  { key: 'gradient', label: 'Gradient', desc: 'Two-colour blend' },
]

const CARD_STYLES: { key: FormCardStyle; label: string; desc: string }[] = [
  { key: 'transparent', label: 'Full page',  desc: 'Content fills the screen' },
  { key: 'glass',       label: 'Glass card', desc: 'Frosted glass floating card' },
  { key: 'white',       label: 'White card', desc: 'Solid white card' },
  { key: 'dark',        label: 'Dark card',  desc: 'Dark card, light text' },
]

const BUTTON_SHAPES: { key: FormButtonShape; label: string; radius: string }[] = [
  { key: 'sharp',   label: 'Sharp',   radius: '0px' },
  { key: 'rounded', label: 'Rounded', radius: '8px' },
  { key: 'pill',    label: 'Pill',    radius: '9999px' },
]

const INPUT_STYLES: { key: FormInputStyle; label: string; desc: string }[] = [
  { key: 'outlined',  label: 'Outlined',  desc: 'Border on all sides' },
  { key: 'filled',    label: 'Filled',    desc: 'Shaded background' },
  { key: 'underline', label: 'Underline', desc: 'Bottom border only' },
]

// ── Shared sub-components ─────────────────────────────────────

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-[#111111]">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="size-8 cursor-pointer rounded border border-[#E5E5E5] p-0.5 bg-white"
        />
        <input
          type="text"
          value={value}
          maxLength={7}
          onChange={(e) => onChange(e.target.value)}
          className="w-24 rounded border border-[#E5E5E5] px-2 py-1 text-xs font-mono text-[#111111] focus:outline-none focus:border-[#111111]"
        />
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 border-t border-[#E5E5E5] pt-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted">{title}</p>
      {children}
    </div>
  )
}

// ── Mini live preview ─────────────────────────────────────────

function FormPreview({ theme, eventName }: { theme: FormTheme; eventName: string }) {
  const isDark =
    theme.cardStyle === 'dark'  ? true  :
    theme.cardStyle === 'white' ? false :
    isColorDark(theme.color1)

  const btnRadius  = theme.buttonShape === 'sharp' ? '0px' : theme.buttonShape === 'pill' ? '9999px' : '8px'
  const isAccDark  = isColorDark(theme.accentColor)
  const textColor  = theme.textColor  || (isDark ? 'rgba(255,255,255,0.92)' : '#111111')
  const mutedColor = theme.mutedColor || (isDark ? 'rgba(255,255,255,0.45)' : '#888888')
  const fontEntry  = FONT_OPTIONS.find(f => f.key === theme.fontFamily) ?? FONT_OPTIONS[0]

  // Card overlay
  const cardStyle: React.CSSProperties =
    theme.cardStyle === 'glass' ? {
      background: 'rgba(255,255,255,0.15)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.25)',
      borderRadius: 12,
      padding: 14,
    } :
    theme.cardStyle === 'white' ? {
      background: '#ffffff',
      border: '1px solid #E5E5E5',
      borderRadius: 12,
      padding: 14,
    } :
    theme.cardStyle === 'dark' ? {
      background: '#111111',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 12,
      padding: 14,
    } :
    { padding: 14 }

  // Input sample
  const sampleInput: React.CSSProperties =
    theme.inputStyle === 'underline' ? {
      borderBottom: `2px solid ${isDark ? 'rgba(255,255,255,0.3)' : '#D1D1D1'}`,
      background: 'transparent',
      borderRadius: 0,
      padding: '3px 0',
    } :
    theme.inputStyle === 'filled' ? {
      background: isDark ? 'rgba(255,255,255,0.12)' : '#F5F5F5',
      borderRadius: 5,
      padding: '4px 8px',
      border: 'none',
    } :
    {
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.2)' : '#E5E5E5'}`,
      background: isDark ? 'rgba(255,255,255,0.06)' : '#ffffff',
      borderRadius: 5,
      padding: '4px 8px',
    }

  return (
    <div
      className="relative h-60 w-full overflow-hidden rounded-lg border border-[#E5E5E5]"
      style={{ background: getBackgroundCSS(theme), fontFamily: fontEntry.css }}
    >
      {/* Particle dots hint */}
      {theme.particles && (
        <div className="pointer-events-none absolute inset-0">
          {Array.from({ length: 14 }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                width:  (i % 3) + 2,
                height: (i % 3) + 2,
                left:   `${((i * 41) % 90) + 5}%`,
                top:    `${((i * 67) % 90) + 5}%`,
                backgroundColor: theme.particleColor,
                opacity: 0.55,
              }}
            />
          ))}
        </div>
      )}

      {/* Card + form content */}
      <div className="absolute inset-0 flex items-center justify-center p-5">
        <div style={{ width: '100%', maxWidth: 210, ...cardStyle }}>
          <p className="text-[11px] font-semibold mb-0.5 truncate" style={{ color: textColor }}>
            {eventName}
          </p>
          <p className="text-[9px] mb-3" style={{ color: mutedColor }}>Event Registration</p>

          <p className="text-[9px] font-medium mb-1" style={{ color: textColor }}>Full Name *</p>
          <div className="mb-2 text-[9px] w-full" style={{ ...sampleInput, color: mutedColor }}>
            Your full name
          </div>

          <p className="text-[9px] font-medium mb-1" style={{ color: textColor }}>Church Branch *</p>
          <div className="mb-3 text-[9px] w-full" style={{ ...sampleInput, color: mutedColor }}>
            Select branch...
          </div>

          <div
            className="w-full text-center text-[9px] font-semibold py-1.5"
            style={{
              backgroundColor: theme.accentColor,
              color:           isAccDark ? '#ffffff' : '#111111',
              borderRadius:    btnRadius,
            }}
          >
            Submit Registration
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────

export default function FormEditor({ event, globalChurches }: { event: EventWithPackages; globalChurches: string[] }) {
  const router = useRouter()
  const [tab,        setTab]       = useState<Tab>('fields')
  const [saving,     setSaving]    = useState(false)
  const [uploading,  setUploading] = useState(false)

  const [coreFields,   setCoreFields]   = useState<CoreField[] | null>(event.core_fields ?? null)
  const [customFields, setCustomFields] = useState<CustomField[]>(event.custom_fields ?? [])

  const [theme, setTheme] = useState<FormTheme>(resolveTheme(event.form_theme))
  const set = (patch: Partial<FormTheme>) => setTheme((t) => ({ ...t, ...patch }))

  // Load Google Font for live preview whenever fontFamily changes
  useEffect(() => {
    const font = FONT_OPTIONS.find(f => f.key === theme.fontFamily)
    if (!font?.url) return
    const id = `preview-font-${font.key}`
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id   = id
    link.rel  = 'stylesheet'
    link.href = font.url
    document.head.appendChild(link)
  }, [theme.fontFamily])

  async function handleBannerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const fd = new FormData()
    fd.append('banner', file)
    const res = await uploadEventBanner(event.id, fd)
    setUploading(false)
    if (res.error) toast.error(res.error)
    else if (res.url) { set({ bannerUrl: res.url }); toast.success('Banner uploaded') }
    // reset file input so the same file can be re-uploaded after changes
    e.target.value = ''
  }

  async function saveTheme() {
    setSaving(true)
    const res = await updateEvent(event.id, { form_theme: theme as unknown as Record<string, string> })
    setSaving(false)
    if (res.error) toast.error(res.error)
    else { toast.success('Theme saved'); router.refresh() }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'fields', label: 'Form Fields' },
    { key: 'theme',  label: 'Theme' },
  ]

  return (
    <div className="max-w-2xl space-y-6">
      {/* Live form preview link */}
      <a
        href={`/register/${event.slug}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded border border-[#E5E5E5] px-3 py-2 text-sm text-muted hover:text-[#111111] hover:border-[#111111] transition-colors"
      >
        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
        </svg>
        Preview form
      </a>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-[#E5E5E5]">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === key
                ? 'border-[#111111] text-[#111111]'
                : 'border-transparent text-muted hover:text-[#111111]'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Form Fields tab ── */}
      {tab === 'fields' && (
        <div className="space-y-8">
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted mb-4">Core Fields</h2>
            <p className="text-sm text-muted mb-4">
              Rename labels, toggle required/optional, or hide fields you don&apos;t need.
              Changes save automatically.
            </p>
            <CoreFieldsEditor
              eventId={event.id}
              fields={coreFields}
              onChange={setCoreFields}
              globalChurches={globalChurches}
            />
          </section>

          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted mb-4">Custom Fields</h2>
            <p className="text-sm text-muted mb-4">
              Add extra fields specific to this event &mdash; text, dropdowns, checkboxes.
              These appear after the core fields on the registration form.
            </p>
            <CustomFieldsBuilder
              eventId={event.id}
              fields={customFields}
              onChange={setCustomFields}
            />
          </section>
        </div>
      )}

      {/* ── Theme tab ── */}
      {tab === 'theme' && (
        <div className="space-y-0">
          {/* Live preview */}
          <FormPreview theme={theme} eventName={event.name} />

          {/* ── Banner ── */}
          <Section title="Header Banner">
            {/* Mode selector */}
            <div className="grid grid-cols-3 gap-2">
              {(['none', 'color', 'image'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => set({ bannerMode: mode })}
                  className={cn(
                    'rounded border-2 px-3 py-2.5 text-left transition-colors capitalize',
                    (theme.bannerMode ?? 'none') === mode
                      ? 'border-[#111111] bg-[#fafafa]'
                      : 'border-[#E5E5E5] hover:border-[#999]'
                  )}
                >
                  <p className="text-xs font-semibold text-[#111111] capitalize">{mode === 'none' ? 'None' : mode === 'color' ? 'Colour strip' : 'Image'}</p>
                  <p className="text-[10px] text-muted mt-0.5">
                    {mode === 'none' ? 'No banner' : mode === 'color' ? 'Solid colour fill' : 'Photo or graphic'}
                  </p>
                </button>
              ))}
            </div>

            {/* ── Colour mode ── */}
            {(theme.bannerMode ?? 'none') === 'color' && (
              <div className="space-y-3">
                {/* Preview strip */}
                <div
                  className="h-16 w-full rounded-lg border border-[#E5E5E5]"
                  style={{ backgroundColor: theme.bannerColor ?? '#6366f1' }}
                />
                <ColorRow
                  label="Banner colour"
                  value={theme.bannerColor ?? '#6366f1'}
                  onChange={(v) => set({ bannerColor: v })}
                />
              </div>
            )}

            {/* ── Image mode ── */}
            {(theme.bannerMode ?? 'none') === 'image' && (
              <div className="space-y-3">
                {/* Preview / upload zone */}
                {theme.bannerUrl ? (
                  <div className="relative overflow-hidden rounded-lg border border-[#E5E5E5]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={theme.bannerUrl} alt="Banner preview" className="h-32 w-full object-cover" />
                    <div className="absolute inset-0 flex items-end justify-end gap-2 p-2">
                      <label className="cursor-pointer rounded border border-white/60 bg-black/40 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm hover:bg-black/60 transition-colors">
                        {uploading ? 'Uploading...' : 'Replace'}
                        <input type="file" accept="image/*" className="sr-only" disabled={uploading} onChange={handleBannerUpload} />
                      </label>
                      <button
                        type="button"
                        onClick={() => set({ bannerUrl: undefined })}
                        className="rounded border border-white/60 bg-black/40 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm hover:bg-red-500/80 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className={cn(
                    'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[#E5E5E5] py-8 transition-colors hover:border-[#111111]',
                    uploading && 'pointer-events-none opacity-60'
                  )}>
                    {uploading ? (
                      <svg className="size-5 animate-spin text-muted" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                    ) : (
                      <svg className="size-5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 21h18M6.75 6.75h.008v.008H6.75V6.75z" />
                      </svg>
                    )}
                    <span className="text-sm font-medium text-[#111111]">
                      {uploading ? 'Uploading...' : 'Upload image'}
                    </span>
                    <span className="text-xs text-muted">JPG, PNG, WebP, GIF &middot; max 5 MB &middot; 1200&times;400px recommended</span>
                    <input type="file" accept="image/*" className="sr-only" disabled={uploading} onChange={handleBannerUpload} />
                  </label>
                )}

                {/* URL fallback */}
                <div>
                  <p className="mb-1.5 text-xs text-muted">Or paste an image URL</p>
                  <input
                    type="url"
                    value={theme.bannerUrl ?? ''}
                    onChange={(e) => set({ bannerUrl: e.target.value || undefined })}
                    placeholder="https://example.com/banner.jpg"
                    className="w-full rounded border border-[#E5E5E5] px-3 py-2 text-sm text-[#111111] placeholder:text-muted focus:border-[#111111] focus:outline-none"
                  />
                </div>
              </div>
            )}
          </Section>

          {/* ── Background ── */}
          <Section title="Background">
            <div className="grid grid-cols-3 gap-2">
              {BG_TYPES.map(({ key, label, desc }) => (
                <button key={key} type="button" onClick={() => set({ type: key })}
                  className={cn(
                    'rounded border-2 px-3 py-2.5 text-left transition-colors',
                    theme.type === key ? 'border-[#111111] bg-[#fafafa]' : 'border-[#E5E5E5] hover:border-[#999]'
                  )}
                >
                  <p className="text-xs font-semibold text-[#111111]">{label}</p>
                  <p className="text-[10px] text-muted mt-0.5">{desc}</p>
                </button>
              ))}
            </div>

            <div className="space-y-3 pt-1">
              {theme.type === 'solid' && (
                <ColorRow label="Background colour" value={theme.color1} onChange={(v) => set({ color1: v })} />
              )}
              {theme.type === 'gradient' && (
                <>
                  <ColorRow label="From" value={theme.color1} onChange={(v) => set({ color1: v })} />
                  <ColorRow label="To"   value={theme.color2} onChange={(v) => set({ color2: v })} />
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-[#111111]">Angle</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="range" min={0} max={360} value={theme.angle}
                        onChange={(e) => set({ angle: Number(e.target.value) })}
                        className="w-32 accent-[#111111]"
                      />
                      <span className="text-xs font-mono text-muted w-10 text-right">{theme.angle}&deg;</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Particle overlay — independent of bg type */}
            <div className="flex items-center justify-between rounded border border-[#E5E5E5] px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-[#111111]">Particle overlay</p>
                <p className="text-[10px] text-muted mt-0.5">Floating animated dots on top of any background</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={theme.particles}
                onClick={() => set({ particles: !theme.particles })}
                className={cn(
                  'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none',
                  theme.particles ? 'bg-[#111111]' : 'bg-[#D1D1D1]'
                )}
              >
                <span className={cn(
                  'pointer-events-none inline-block size-4 rounded-full bg-white shadow transition-transform',
                  theme.particles ? 'translate-x-4' : 'translate-x-0'
                )} />
              </button>
            </div>

            {theme.particles && (
              <ColorRow label="Particle colour" value={theme.particleColor} onChange={(v) => set({ particleColor: v })} />
            )}
          </Section>

          {/* ── Accent colour ── */}
          <Section title="Accent Colour">
            <p className="text-xs text-muted -mt-1">Applied to buttons, radio fills, and focus states.</p>
            <ColorRow label="Accent" value={theme.accentColor} onChange={(v) => set({ accentColor: v })} />
          </Section>

          {/* ── Text colours ── */}
          {(() => {
            const bgIsDark =
              theme.cardStyle === 'dark'  ? true  :
              theme.cardStyle === 'white' ? false :
              isColorDark(theme.color1)
            const autoText  = bgIsDark ? '#ffffff' : '#111111'
            const autoMuted = bgIsDark ? '#aaaaaa' : '#888888'

            return (
              <Section title="Text Colours">
                <p className="text-xs text-muted -mt-1">
                  Leave on Auto to follow background darkness automatically.
                </p>

                {/* Primary text */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[#111111]">Primary text</span>
                    {!theme.textColor && (
                      <span className="rounded border border-[#E5E5E5] px-1.5 py-0.5 text-[10px] text-muted">Auto</span>
                    )}
                    {theme.textColor && (
                      <button
                        type="button"
                        onClick={() => set({ textColor: '' })}
                        className="rounded border border-[#E5E5E5] px-1.5 py-0.5 text-[10px] text-muted hover:text-[#111111] transition-colors"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={theme.textColor || autoText}
                      onChange={(e) => set({ textColor: e.target.value })}
                      className="size-8 cursor-pointer rounded border border-[#E5E5E5] p-0.5 bg-white"
                    />
                    <input
                      type="text"
                      value={theme.textColor || autoText}
                      maxLength={7}
                      onChange={(e) => set({ textColor: e.target.value })}
                      className="w-24 rounded border border-[#E5E5E5] px-2 py-1 text-xs font-mono text-[#111111] focus:outline-none focus:border-[#111111]"
                    />
                  </div>
                </div>

                {/* Secondary / muted text */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[#111111]">Secondary text</span>
                    {!theme.mutedColor && (
                      <span className="rounded border border-[#E5E5E5] px-1.5 py-0.5 text-[10px] text-muted">Auto</span>
                    )}
                    {theme.mutedColor && (
                      <button
                        type="button"
                        onClick={() => set({ mutedColor: '' })}
                        className="rounded border border-[#E5E5E5] px-1.5 py-0.5 text-[10px] text-muted hover:text-[#111111] transition-colors"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={theme.mutedColor || autoMuted}
                      onChange={(e) => set({ mutedColor: e.target.value })}
                      className="size-8 cursor-pointer rounded border border-[#E5E5E5] p-0.5 bg-white"
                    />
                    <input
                      type="text"
                      value={theme.mutedColor || autoMuted}
                      maxLength={7}
                      onChange={(e) => set({ mutedColor: e.target.value })}
                      className="w-24 rounded border border-[#E5E5E5] px-2 py-1 text-xs font-mono text-[#111111] focus:outline-none focus:border-[#111111]"
                    />
                  </div>
                </div>
              </Section>
            )
          })()}

          {/* ── Typography ── */}
          <Section title="Typography">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {FONT_OPTIONS.map(({ key, label, css }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => set({ fontFamily: key })}
                  className={cn(
                    'rounded border-2 px-3 py-2.5 text-left transition-colors',
                    theme.fontFamily === key ? 'border-[#111111] bg-[#fafafa]' : 'border-[#E5E5E5] hover:border-[#999]'
                  )}
                >
                  <p className="text-base font-semibold text-[#111111]" style={{ fontFamily: css }}>Aa</p>
                  <p className="text-[10px] text-muted mt-0.5" style={{ fontFamily: 'inherit' }}>{label}</p>
                </button>
              ))}
            </div>
          </Section>

          {/* ── Form card ── */}
          <Section title="Form Card">
            <div className="grid grid-cols-2 gap-2">
              {CARD_STYLES.map(({ key, label, desc }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => set({ cardStyle: key })}
                  className={cn(
                    'rounded border-2 px-3 py-2.5 text-left transition-colors',
                    theme.cardStyle === key ? 'border-[#111111] bg-[#fafafa]' : 'border-[#E5E5E5] hover:border-[#999]'
                  )}
                >
                  <p className="text-xs font-semibold text-[#111111]">{label}</p>
                  <p className="text-[10px] text-muted mt-0.5">{desc}</p>
                </button>
              ))}
            </div>
          </Section>

          {/* ── Button shape ── */}
          <Section title="Button Shape">
            <div className="grid grid-cols-3 gap-2">
              {BUTTON_SHAPES.map(({ key, label, radius }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => set({ buttonShape: key })}
                  className={cn(
                    'border-2 px-3 pb-2.5 pt-3 text-center transition-colors',
                    theme.buttonShape === key ? 'border-[#111111] bg-[#fafafa]' : 'border-[#E5E5E5] hover:border-[#999]',
                    key === 'sharp'   && 'rounded-none',
                    key === 'rounded' && 'rounded',
                    key === 'pill'    && 'rounded-full'
                  )}
                >
                  <div className="flex justify-center mb-1.5">
                    <div className="h-4 w-14 bg-[#111111]" style={{ borderRadius: radius }} />
                  </div>
                  <p className="text-[10px] text-muted">{label}</p>
                </button>
              ))}
            </div>
          </Section>

          {/* ── Input style ── */}
          <Section title="Input Style">
            <div className="grid grid-cols-3 gap-2">
              {INPUT_STYLES.map(({ key, label, desc }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => set({ inputStyle: key })}
                  className={cn(
                    'rounded border-2 px-3 py-2.5 text-left transition-colors',
                    theme.inputStyle === key ? 'border-[#111111] bg-[#fafafa]' : 'border-[#E5E5E5] hover:border-[#999]'
                  )}
                >
                  <div className="mb-1.5 h-5 w-full">
                    {key === 'outlined'  && <div className="h-5 w-full rounded border border-[#C8C8C8]" />}
                    {key === 'filled'    && <div className="h-5 w-full rounded bg-[#EFEFEF]" />}
                    {key === 'underline' && <div className="h-5 w-full border-b-2 border-[#C8C8C8]" />}
                  </div>
                  <p className="text-xs font-semibold text-[#111111]">{label}</p>
                  <p className="text-[10px] text-muted mt-0.5">{desc}</p>
                </button>
              ))}
            </div>
          </Section>

          {/* Save / Reset */}
          <div className="pt-6 flex items-center gap-3">
            <button
              onClick={saveTheme}
              disabled={saving}
              className="rounded bg-[#111111] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#2a2a2a] disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Theme'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                setTheme(DEFAULT_FORM_THEME)
                setSaving(true)
                const res = await updateEvent(event.id, { form_theme: DEFAULT_FORM_THEME as unknown as Record<string, string> })
                setSaving(false)
                if (res.error) toast.error(res.error)
                else { toast.success('Theme reset to default'); router.refresh() }
              }}
              className="rounded border border-[#E5E5E5] px-4 py-2.5 text-sm text-muted hover:text-[#111111] hover:border-[#111111] disabled:opacity-50 transition-colors"
            >
              Reset to default
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
