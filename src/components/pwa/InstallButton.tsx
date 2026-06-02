'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'

type Platform = 'android' | 'ios' | 'desktop'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface Props {
  variant?: 'banner' | 'button'
}

export default function InstallButton({ variant = 'button' }: Props) {
  const [platform, setPlatform] = useState<Platform>('desktop')
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [showIOSSteps, setShowIOSSteps] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true)
      return
    }
    const ua = navigator.userAgent
    if (/iPhone|iPad|iPod/.test(ua)) {
      setPlatform('ios')
    } else if (/Android/.test(ua)) {
      setPlatform('android')
    }
    // Desktop also gets the prompt — Chrome/Edge fire beforeinstallprompt too
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setInstalled(true)
    setDeferredPrompt(null)
  }

  // ── Banner variant (login page) ───────────────────────────────
  if (variant === 'banner') {
    if (installed) return null

    return (
      <div className="rounded border border-[#E5E5E5] bg-white p-3 shadow-sm">
        {/* Main row */}
        <div className="flex items-center gap-3">
          {/* App icon */}
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded border border-[#E5E5E5]">
            <Image src="/gmschurch_logo.jpg" alt="GMS Events" width={72} height={72} className="h-full w-full object-cover" />
          </div>

          {/* Text */}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#111111]">GMS Events Scanner</p>
            <p className="text-xs text-muted">
              {platform === 'ios'
                ? 'Add to your home screen via Safari'
                : platform === 'android'
                ? 'Install the scanner app on your device'
                : 'Install the scanner app on your device'}
            </p>
          </div>

          {/* Action button */}
          {platform === 'android' && (
            <button
              onClick={handleInstall}
              className="shrink-0 rounded bg-[#111111] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#2a2a2a] transition-colors"
            >
              Install
            </button>
          )}
          {platform === 'ios' && (
            <button
              onClick={() => setShowIOSSteps((v) => !v)}
              className="shrink-0 rounded bg-[#111111] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#2a2a2a] transition-colors"
            >
              How To
            </button>
          )}
          {platform === 'desktop' && (
            <button
              onClick={deferredPrompt ? handleInstall : () => setShowIOSSteps((v) => !v)}
              className="shrink-0 rounded bg-[#111111] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#2a2a2a] transition-colors"
            >
              Install
            </button>
          )}
        </div>

        {/* iOS / Desktop steps (expandable) */}
        {showIOSSteps && platform === 'ios' && (
          <div className="mt-3 space-y-1.5 border-t border-[#E5E5E5] pt-3">
            <Step n={1}>Open this page in <strong>Safari</strong></Step>
            <Step n={2}>
              Tap the <ShareIcon className="inline size-4 align-text-bottom" />{' '}
              <strong>Share</strong> button at the bottom
            </Step>
            <Step n={3}>Scroll down and tap <strong>"Add to Home Screen"</strong></Step>
            <Step n={4}>Tap <strong>Add</strong> — done!</Step>
          </div>
        )}
        {showIOSSteps && platform === 'desktop' && (
          <div className="mt-3 space-y-1.5 border-t border-[#E5E5E5] pt-3">
            <Step n={1}>
              Look for the <DesktopInstallIcon className="inline size-4 align-text-bottom" />{' '}
              install icon in your browser's <strong>address bar</strong>
            </Step>
            <Step n={2}>Click it and select <strong>"Install"</strong></Step>
            <Step n={3}>The app will open as its own window — pin it to your taskbar</Step>
          </div>
        )}
      </div>
    )
  }

  // ── Button variant (dashboard sidebar) — always visible ──────

  // Already installed → open the app
  if (installed) {
    return (
      <a
        href="/scan"
        className="flex w-full items-center justify-center gap-2 rounded border border-[#E5E5E5] px-3 py-2 text-sm font-medium text-[#111111] hover:bg-[#f5f5f5] transition-colors"
      >
        <DownloadIcon />
        Open Scanner App
      </a>
    )
  }

  // Android / Desktop with native prompt → one-click install
  if (deferredPrompt) {
    return (
      <button
        onClick={handleInstall}
        className="flex w-full items-center justify-center gap-2 rounded border border-[#E5E5E5] px-3 py-2 text-sm font-medium text-[#111111] hover:bg-[#f5f5f5] transition-colors"
      >
        <DownloadIcon />
        Install Scanner App
      </button>
    )
  }

  // iOS or desktop without prompt → how-to steps toggle
  return (
    <div>
      <button
        onClick={() => setShowIOSSteps((v) => !v)}
        className="flex w-full items-center justify-center gap-2 rounded border border-[#E5E5E5] px-3 py-2 text-sm font-medium text-[#111111] hover:bg-[#f5f5f5] transition-colors"
      >
        <DownloadIcon />
        Install Scanner App
      </button>
      {showIOSSteps && (
        <div className="mt-2 rounded border border-[#E5E5E5] px-3 py-2 text-xs text-muted space-y-1">
          {platform === 'ios' ? (
            <>
              <p><span className="font-medium text-[#111111]">1.</span> Open in Safari</p>
              <p><span className="font-medium text-[#111111]">2.</span> Tap <ShareIcon className="inline size-3" /> Share</p>
              <p><span className="font-medium text-[#111111]">3.</span> "Add to Home Screen"</p>
            </>
          ) : (
            <>
              <p><span className="font-medium text-[#111111]">1.</span> Click the install icon in your browser's address bar</p>
              <p><span className="font-medium text-[#111111]">2.</span> Select "Install"</p>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-xs text-muted">
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#111111] text-[10px] font-bold text-white">
        {n}
      </span>
      <span>{children}</span>
    </div>
  )
}

function ShareIcon({ className = 'inline size-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  )
}

function DesktopInstallIcon({ className = 'inline size-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15M9 12l3 3m0 0l3-3m-3 3V2.25" />
    </svg>
  )
}
