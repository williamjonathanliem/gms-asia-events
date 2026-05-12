'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { NotFoundException } from '@zxing/library'
import { processScan, type ScanMode, type ScanResponse } from '@/app/scan/actions'

type ScanState = 'idle' | 'processing' | 'success' | 'error'

function playBeep(success: boolean) {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.value = success ? 880 : 330
    gain.gain.value = 0.25
    osc.start()
    setTimeout(() => { osc.stop(); ctx.close() }, success ? 120 : 280)
  } catch { /* AudioContext may be blocked — silently skip */ }
}

export default function QRScanner() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const processingRef = useRef(false)
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [mode, setMode] = useState<ScanMode>('toolkit')
  const modeRef = useRef<ScanMode>('toolkit') // stable ref for callback closure

  const [scanState, setScanState] = useState<ScanState>('idle')
  const [flashColor, setFlashColor] = useState<'success' | 'error'>('success')
  const [showFlash, setShowFlash] = useState(false)
  const [result, setResult] = useState<ScanResponse | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [scanCount, setScanCount] = useState(0)
  const [torchOn, setTorchOn] = useState(false)
  const [manualToken, setManualToken] = useState('')
  const [cameraError, setCameraError] = useState<string | null>(null)

  // Keep modeRef in sync so the decode callback always uses the latest mode
  useEffect(() => { modeRef.current = mode }, [mode])

  const handleScanToken = useCallback(async (token: string) => {
    if (processingRef.current || !token.trim()) return
    processingRef.current = true
    setScanState('processing')

    let res: ScanResponse
    try {
      res = await processScan(token.trim(), modeRef.current)
    } catch {
      res = { success: false, message: 'Connection error — check network' }
    }

    playBeep(res.success)
    setFlashColor(res.success ? 'success' : 'error')
    setShowFlash(true)
    setResult(res)
    setShowResult(true)
    setScanState(res.success ? 'success' : 'error')
    if (res.success) setScanCount((c) => c + 1)

    // Hide flash quickly, keep result card for 2 s
    setTimeout(() => setShowFlash(false), 600)

    if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
    resetTimerRef.current = setTimeout(() => {
      setShowResult(false)
      setScanState('idle')
      setResult(null)
      processingRef.current = false
    }, 2000)
  }, [])

  // ── Start camera ──────────────────────────────────────────────
  useEffect(() => {
    if (!videoRef.current) return
    let mounted = true
    const reader = new BrowserMultiFormatReader()

    ;(async () => {
      try {
        // Prefer rear camera on mobile
        const devices = await BrowserMultiFormatReader.listVideoInputDevices()
        const rearDevice = devices.find((d) =>
          /back|rear|environment/i.test(d.label)
        )
        const deviceId = rearDevice?.deviceId ?? devices[0]?.deviceId

        const controls = await reader.decodeFromVideoDevice(
          deviceId,
          videoRef.current!,
          (result, err) => {
            if (!mounted) return
            if (result) handleScanToken(result.getText())
            if (err && !(err instanceof NotFoundException)) {
              // non-decode errors — ignore, don't spam
            }
          }
        )
        if (mounted) controlsRef.current = controls
      } catch (err: any) {
        if (!mounted) return
        setCameraError(
          err?.name === 'NotAllowedError'
            ? 'Camera permission denied. Enable camera access and refresh.'
            : 'Could not start camera. Please refresh and try again.'
        )
      }
    })()

    return () => {
      mounted = false
      controlsRef.current?.stop()
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
    }
  }, [handleScanToken])

  // ── Torch toggle ──────────────────────────────────────────────
  const toggleTorch = async () => {
    const stream = videoRef.current?.srcObject as MediaStream | null
    const track = stream?.getVideoTracks()[0]
    if (!track) return
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] })
      setTorchOn((t) => !t)
    } catch { /* torch not supported on this device */ }
  }

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (manualToken.trim()) {
      handleScanToken(manualToken.trim())
      setManualToken('')
    }
  }

  // ── Camera error state ────────────────────────────────────────
  if (cameraError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-black px-6">
        <svg className="size-10 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <p className="max-w-xs text-center text-sm text-white/70">{cameraError}</p>
        <form onSubmit={handleManualSubmit} className="flex w-full max-w-sm gap-2">
          <input
            value={manualToken}
            onChange={(e) => setManualToken(e.target.value)}
            placeholder="Enter token manually…"
            className="flex-1 rounded-md border border-white/20 bg-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/40"
          />
          <button
            type="submit"
            className="rounded-md bg-white px-4 py-2.5 text-sm font-medium text-black disabled:opacity-40"
            disabled={!manualToken.trim()}
          >
            Go
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-black">
      {/* Camera feed */}
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        playsInline
        muted
      />

      {/* Ambient dark gradient so UI is readable */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/70 pointer-events-none" />

      {/* Flash overlay */}
      {showFlash && (
        <div
          className={`animate-flash pointer-events-none absolute inset-0 ${
            flashColor === 'success' ? 'bg-success' : 'bg-error'
          }`}
        />
      )}

      {/* ── Viewfinder ── */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative size-60">
          {/* White corner marks */}
          <span className="absolute top-0 left-0 size-8 border-t-2 border-l-2 border-white" />
          <span className="absolute top-0 right-0 size-8 border-t-2 border-r-2 border-white" />
          <span className="absolute bottom-0 left-0 size-8 border-b-2 border-l-2 border-white" />
          <span className="absolute bottom-0 right-0 size-8 border-b-2 border-r-2 border-white" />
        </div>
      </div>

      {/* ── Top bar ── */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 py-6 gap-3">
        {/* Back button */}
        <Link
          href="/dashboard"
          className="rounded-full p-2.5 bg-black/40 text-white backdrop-blur-md hover:bg-black/60 transition-colors shrink-0"
        >
          <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </Link>

        {/* Mode selector */}
        <div className="flex gap-1 rounded-lg bg-black/40 p-1 backdrop-blur-md">
          {(['toolkit', 'event'] as ScanMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              disabled={scanState === 'processing'}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                mode === m
                  ? 'bg-white text-black'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              {m === 'toolkit' ? 'Toolkit' : 'Attendance'}
            </button>
          ))}
        </div>

        {/* Torch button */}
        <button
          onClick={toggleTorch}
          className={`rounded-full p-2.5 backdrop-blur-md transition-colors shrink-0 ${
            torchOn ? 'bg-white text-black' : 'bg-black/40 text-white hover:bg-black/60'
          }`}
        >
          <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
          </svg>
        </button>
      </div>

      {/* ── Processing spinner ── */}
      {scanState === 'processing' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-full bg-black/50 p-4 backdrop-blur-sm">
            <svg className="size-8 animate-spin text-white" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          </div>
        </div>
      )}

      {/* ── Bottom bar (counter + manual entry) ── */}
      <div className="absolute bottom-0 left-0 right-0 space-y-3 px-5 pb-6">
        <p className="text-center text-xs font-medium text-white/50">
          {scanCount} scan{scanCount !== 1 ? 's' : ''} this session
        </p>
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            value={manualToken}
            onChange={(e) => setManualToken(e.target.value)}
            placeholder="Manual token entry…"
            className="flex-1 rounded-md border border-white/20 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-white/40 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-white/40"
          />
          <button
            type="submit"
            disabled={!manualToken.trim() || scanState === 'processing'}
            className="rounded-md bg-white px-4 py-2.5 text-sm font-medium text-black disabled:opacity-40 transition-opacity"
          >
            Go
          </button>
        </form>
      </div>

      {/* ── Result card (slides up) ── */}
      <div
        className={`absolute bottom-0 left-0 right-0 rounded-t-2xl bg-white px-6 pb-8 pt-5 transition-transform duration-300 ${
          showResult ? 'translate-y-0' : 'translate-y-full'
        } ${result?.success ? 'border-t-4 border-success' : 'border-t-4 border-error'}`}
      >
        {result?.success ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-widest text-success">
              {mode === 'toolkit' ? 'Toolkit Collected' : 'Checked In'} ✓
            </p>
            <p className="mt-1 text-3xl font-bold text-[#111111] leading-tight">{result.name}</p>
            <p className="mt-1 text-sm text-muted">Package {result.packageName}</p>
            {result.toolkitItems.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {result.toolkitItems.map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-muted">
                    <span className="size-1 shrink-0 rounded-full bg-success" />
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <>
            <p className="text-lg font-semibold text-error">
              {result?.message ?? 'Scan failed'}
            </p>
            <p className="mt-1 text-sm text-muted">Please contact an administrator if this persists.</p>
          </>
        )}
      </div>
    </div>
  )
}
