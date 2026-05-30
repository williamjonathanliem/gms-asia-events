'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

type InstallState = 'hidden' | 'android' | 'ios' | 'installed'

interface Props {
  variant?: 'banner' | 'button'
}

export default function InstallButton({ variant = 'button' }: Props) {
  const [state, setState] = useState<InstallState>('hidden')
  const [prompt, setPrompt] = useState<any>(null)
  const [showIosSteps, setShowIosSteps] = useState(false)

  useEffect(() => {
    // Already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setState('installed')
      return
    }

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const isInWebApp = (navigator as any).standalone

    if (isIos && !isInWebApp) {
      setState('ios')
      return
    }

    // Android / Chrome — wait for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e)
      setState('android')
    }
    window.addEventListener('beforeinstallprompt', handler)

    window.addEventListener('appinstalled', () => setState('installed'))

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleAndroidInstall() {
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setState('installed')
  }

  if (state === 'hidden') return null

  const downloadIcon = (
    <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  )

  // ── Banner variant (login page) ───────────────────────────────
  if (variant === 'banner') {
    return (
      <div className="w-full rounded-xl border border-[#E5E5E5] bg-[#fafafa] px-4 py-4">
        <div className="flex items-center gap-3">
          <Image src="/gmschurch_logo.jpg" alt="GMS" width={36} height={36} className="shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#111111]">GMS Events Scanner</p>
            <p className="text-xs text-muted">
              {state === 'installed' ? 'Scanner app is installed on this device' : 'Install the scanner app on your device'}
            </p>
          </div>
          {state === 'installed' && (
            <Link
              href="/scan"
              className="shrink-0 rounded-btn bg-[#111111] px-3 py-1.5 text-xs font-medium text-white hover:opacity-80 transition-opacity"
            >
              Open
            </Link>
          )}
          {state === 'android' && (
            <button type="button" onClick={handleAndroidInstall}
              className="shrink-0 rounded-btn bg-[#111111] px-3 py-1.5 text-xs font-medium text-white hover:opacity-80 transition-opacity">
              Install
            </button>
          )}
          {state === 'ios' && (
            <button type="button" onClick={() => setShowIosSteps((v) => !v)}
              className="shrink-0 rounded-btn bg-[#111111] px-3 py-1.5 text-xs font-medium text-white hover:opacity-80 transition-opacity">
              {showIosSteps ? 'Close' : 'How to'}
            </button>
          )}
        </div>

        {state === 'ios' && showIosSteps && (
          <div className="mt-3 space-y-1.5 border-t border-[#E5E5E5] pt-3">
            <p className="text-xs font-medium text-[#111111]">Install on iPhone / iPad:</p>
            <ol className="space-y-1 text-xs text-muted list-decimal list-inside">
              <li>Tap the <strong className="text-[#111111]">Share</strong> button in Safari <span className="font-mono">⬆</span></li>
              <li>Scroll down and tap <strong className="text-[#111111]">Add to Home Screen</strong></li>
              <li>Tap <strong className="text-[#111111]">Add</strong></li>
            </ol>
          </div>
        )}
      </div>
    )
  }

  // ── Button variant (dashboard sidebar) ───────────────────────
  return (
    <div className="px-3 pb-2 space-y-2">
      {state === 'installed' && (
        <Link
          href="/scan"
          className="flex w-full items-center gap-3 rounded-btn border border-[#E5E5E5] px-3 py-2 text-sm text-muted transition-colors hover:bg-[#f5f5f5] hover:text-[#111111]"
        >
          {downloadIcon}
          Scanner App
        </Link>
      )}

      {state === 'android' && (
        <button type="button" onClick={handleAndroidInstall}
          className="flex w-full items-center gap-3 rounded-btn border border-[#E5E5E5] px-3 py-2 text-sm text-muted transition-colors hover:bg-[#f5f5f5] hover:text-[#111111]">
          {downloadIcon}
          Install Scanner App
        </button>
      )}

      {state === 'ios' && (
        <>
          <button type="button" onClick={() => setShowIosSteps((v) => !v)}
            className="flex w-full items-center gap-3 rounded-btn border border-[#E5E5E5] px-3 py-2 text-sm text-muted transition-colors hover:bg-[#f5f5f5] hover:text-[#111111]">
            {downloadIcon}
            Install Scanner App
          </button>
          {showIosSteps && (
            <div className="rounded-lg border border-[#E5E5E5] bg-[#fafafa] px-3 py-3 text-xs">
              <p className="font-medium text-[#111111] mb-1.5">Install on iPhone / iPad:</p>
              <ol className="space-y-1 text-muted list-decimal list-inside">
                <li>Tap <strong className="text-[#111111]">Share ⬆</strong> in Safari</li>
                <li>Tap <strong className="text-[#111111]">Add to Home Screen</strong></li>
                <li>Tap <strong className="text-[#111111]">Add</strong></li>
              </ol>
            </div>
          )}
        </>
      )}
    </div>
  )
}
