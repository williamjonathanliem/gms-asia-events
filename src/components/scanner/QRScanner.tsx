'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser'
import { processScan, type ScanMode, type ScanResponse } from '@/app/scan/actions'

type ScanState = 'idle' | 'processing' | 'success' | 'error'

const NEXT_SCAN_DELAY_MS = 1000
const RESULT_CARD_MS = 2500
// A code still in front of the camera would otherwise re-scan as "Already scanned".
const SAME_CODE_IGNORE_MS = 4000

const CAMERA_STORAGE_KEY = 'scanner_camera_id'
const PREFERRED_ZOOM = 2

type NativeDetector = { detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]> }

// The browser's built-in detector (Chromium on Android) copes with blur and glare far
// better than the JS decoder; browsers without it fall back to zxing.
async function createNativeDetector(): Promise<NativeDetector | null> {
  const Ctor = (window as any).BarcodeDetector
  if (!Ctor) return null
  try {
    const formats: string[] = await Ctor.getSupportedFormats()
    return formats.includes('qr_code') ? new Ctor({ formats: ['qr_code'] }) : null
  } catch {
    return null
  }
}

function readStoredCamera(): string | null {
  try { return localStorage.getItem(CAMERA_STORAGE_KEY) } catch { return null }
}

function storeCamera(id: string | null) {
  try {
    if (id) localStorage.setItem(CAMERA_STORAGE_KEY, id)
    else localStorage.removeItem(CAMERA_STORAGE_KEY)
  } catch { /* storage blocked — the choice just won't persist */ }
}

// One short buzz for success, two longer ones for failure. Not available in iOS Safari.
function vibrate(success: boolean) {
  try { navigator.vibrate?.(success ? 80 : [180, 90, 180]) } catch { /* unsupported */ }
}

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
  const processingRef = useRef(false)
  const zoomedRef = useRef(true)

  const [cameraId, setCameraId] = useState<string | null>(readStoredCamera)
  const [cameras, setCameras] = useState<string[]>([])
  const [activeCamera, setActiveCamera] = useState<string | null>(null)
  const [zoomRange, setZoomRange] = useState<{ min: number; max: number } | null>(null)
  const [zoomed, setZoomed] = useState(true)
  const [mirrored, setMirrored] = useState(false)
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const unlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastScanRef = useRef<{ token: string; at: number } | null>(null)

  const [mode, setMode] = useState<ScanMode>('toolkit')
  const modeRef = useRef<ScanMode>('toolkit') // stable ref for callback closure

  const [scanState, setScanState] = useState<ScanState>('idle')
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
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
    setScanState('processing')

    let res: ScanResponse
    try {
      res = await processScan(token.trim(), modeRef.current)
    } catch {
      res = { success: false, message: 'Connection error — check network' }
    }
    lastScanRef.current = { token: token.trim(), at: Date.now() }

    playBeep(res.success)
    vibrate(res.success)
    setResult(res)
    setShowResult(true)
    setScanState(res.success ? 'success' : 'error')
    if (res.success) setScanCount((c) => c + 1)

    // The next scan is allowed before the result screen goes away.
    unlockTimerRef.current = setTimeout(() => {
      processingRef.current = false
    }, NEXT_SCAN_DELAY_MS)

    resetTimerRef.current = setTimeout(() => {
      setShowResult(false)
      setScanState('idle')
      setResult(null)
    }, RESULT_CARD_MS)
  }, [])

  const dismissResult = () => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
    if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current)
    processingRef.current = false
    setShowResult(false)
    setScanState('idle')
    setResult(null)
  }

  // ── Start camera ──────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let stopped = false
    let stream: MediaStream | null = null
    let zxingControls: IScannerControls | null = null
    let loopTimer: ReturnType<typeof setTimeout> | null = null

    const onCode = (raw: string) => {
      const text = raw.trim()
      const last = lastScanRef.current
      if (last && last.token === text && Date.now() - last.at < SAME_CODE_IGNORE_MS) return
      handleScanToken(text)
    }

    ;(async () => {
      try {
        const detector = await createNativeDetector()
        // The native detector is cheap at 1080p; the JS decoder gets slow above 720p.
        // No `min`, so low-resolution laptop webcams still start.
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            ...(cameraId
              ? { deviceId: { exact: cameraId } }
              : { facingMode: { ideal: 'environment' } }),
            width:  { ideal: detector ? 1920 : 1280 },
            height: { ideal: detector ? 1080 : 720 },
          },
        })
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return }

        const track = stream.getVideoTracks()[0]
        const caps = (track.getCapabilities?.() ?? {}) as any
        const advanced: Record<string, unknown>[] = []
        if (caps.focusMode?.includes?.('continuous')) advanced.push({ focusMode: 'continuous' })
        if (caps.zoom && caps.zoom.max > caps.zoom.min) {
          setZoomRange({ min: caps.zoom.min, max: caps.zoom.max })
          if (zoomedRef.current) advanced.push({ zoom: Math.min(PREFERRED_ZOOM, caps.zoom.max) })
        } else {
          setZoomRange(null)
        }
        if (advanced.length) {
          await track.applyConstraints({ advanced } as MediaTrackConstraints).catch(() => {})
        }

        const inputs = (await navigator.mediaDevices.enumerateDevices())
          .filter((d) => d.kind === 'videoinput')
        // Rear lenses first, then the front camera (for a phone on a stand facing attendees).
        const isRear = (d: MediaDeviceInfo) => /back|rear|environment/i.test(d.label)
        setCameras([...inputs.filter(isRear), ...inputs.filter((d) => !isRear(d))].map((d) => d.deviceId))
        setActiveCamera(track.getSettings().deviceId ?? null)
        setMirrored(track.getSettings().facingMode === 'user')
        setTorchOn(false)

        if (detector) {
          video.srcObject = stream
          await video.play()
          const tick = async () => {
            if (stopped) return
            if (video.readyState >= 2 && !processingRef.current) {
              try {
                const codes = await detector.detect(video)
                if (codes[0]?.rawValue) onCode(codes[0].rawValue)
              } catch { /* a frame that can't be read is just skipped */ }
            }
            loopTimer = setTimeout(tick, 80)
          }
          tick()
        } else {
          // The library default waits 500 ms between attempts, which caps it at ~2 tries a second.
          const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 100 })
          zxingControls = await reader.decodeFromStream(stream, video, (result) => {
            if (!stopped && result) onCode(result.getText())
          })
          if (stopped) zxingControls.stop()
        }
      } catch (err: any) {
        if (stopped) return
        // A remembered camera that no longer exists: forget it and start with the default.
        if (cameraId && ['OverconstrainedError', 'NotFoundError'].includes(err?.name)) {
          storeCamera(null)
          setCameraId(null)
          return
        }
        setCameraError(
          err?.name === 'NotAllowedError'
            ? 'Camera permission denied. Enable camera access and refresh.'
            : 'Could not start camera. Please refresh and try again.'
        )
      }
    })()

    return () => {
      stopped = true
      if (loopTimer) clearTimeout(loopTimer)
      zxingControls?.stop()
      stream?.getTracks().forEach((t) => t.stop())
      video.srcObject = null
    }
  }, [handleScanToken, cameraId])

  useEffect(() => () => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
    if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current)
  }, [])

  const currentTrack = () =>
    (videoRef.current?.srcObject as MediaStream | null)?.getVideoTracks()[0] ?? null

  // ── Torch toggle ──────────────────────────────────────────────
  const toggleTorch = async () => {
    const track = currentTrack()
    if (!track) return
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] })
      setTorchOn((t) => !t)
    } catch { /* torch not supported on this device */ }
  }

  const toggleZoom = async () => {
    const track = currentTrack()
    if (!track || !zoomRange) return
    const next = !zoomed
    const zoom = next ? Math.min(PREFERRED_ZOOM, zoomRange.max) : zoomRange.min
    try {
      await track.applyConstraints({ advanced: [{ zoom } as MediaTrackConstraintSet] })
      zoomedRef.current = next
      setZoomed(next)
    } catch { /* zoom rejected by the device */ }
  }

  // Phones with several rear lenses sometimes hand the browser the wrong one.
  const switchCamera = () => {
    if (cameras.length < 2) return
    const next = cameras[(cameras.indexOf(activeCamera ?? '') + 1) % cameras.length]
    storeCamera(next)
    setCameraId(next)
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
    <div className="relative h-dvh overflow-hidden bg-black">
      {/* Camera feed */}
      <video
        ref={videoRef}
        className={`absolute inset-0 h-full w-full object-cover ${mirrored ? '-scale-x-100' : ''}`}
        playsInline
        muted
      />

      {/* Ambient dark gradient so UI is readable */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/70 pointer-events-none" />

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

      {/* ── Camera controls ── */}
      {(cameras.length > 1 || zoomRange) && (
        <div className="absolute right-5 top-24 flex flex-col gap-2">
          {cameras.length > 1 && (
            <button
              onClick={switchCamera}
              aria-label="Switch camera"
              className="rounded-full p-2.5 bg-black/40 text-white backdrop-blur-md hover:bg-black/60 transition-colors"
            >
              <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </button>
          )}
          {zoomRange && (
            <button
              onClick={toggleZoom}
              aria-label="Toggle zoom"
              className={`size-10 rounded-full text-xs font-semibold backdrop-blur-md transition-colors ${
                zoomed ? 'bg-white text-black' : 'bg-black/40 text-white hover:bg-black/60'
              }`}
            >
              {zoomed ? '2x' : '1x'}
            </button>
          )}
        </div>
      )}

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

      {/* ── Result: full-screen colour so it reads at a glance; tap to dismiss ── */}
      {showResult && result && (
        <button
          type="button"
          onClick={dismissResult}
          className={`absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 px-6 text-center text-white ${
            result.success ? 'bg-success' : 'bg-error'
          }`}
        >
          <svg className="size-28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            {result.success ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            )}
          </svg>

          {result.success ? (
            <>
              <p className="text-base font-semibold uppercase tracking-widest text-white/85">
                {mode === 'toolkit' ? 'Toolkit collected' : 'Checked in'}
              </p>
              <p className="max-w-full break-words text-5xl font-bold leading-tight">{result.name}</p>
              <p className="text-xl font-medium text-white/90">{result.packageName}</p>
              {mode === 'toolkit' && result.toolkitItems.length > 0 && (
                <ul className="mt-2 max-w-sm space-y-1 text-sm text-white/85">
                  {result.toolkitItems.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="max-w-full break-words text-4xl font-bold leading-tight">
              {result.message ?? 'Scan failed'}
            </p>
          )}

          <span className="absolute bottom-8 text-xs text-white/70">Tap to dismiss</span>
        </button>
      )}
    </div>
  )
}
