'use client'

import { useEffect, useRef } from 'react'
import type { FormTheme } from '@/lib/types/database'
import { isColorDark } from '@/lib/types/database'

// ── Compute CSS background string from theme ──────────────────
export function getBackgroundCSS(theme: FormTheme): string {
  if (theme.type === 'gradient') {
    return `linear-gradient(${theme.angle}deg, ${theme.color1} 0%, ${theme.color2} 100%)`
  }
  return theme.color1
}

// ── Is the background dark (needs white text)? ────────────────
export function themeDark(theme: FormTheme): boolean {
  if (theme.type === 'gradient') {
    // Average the two colors
    return isColorDark(theme.color1) || isColorDark(theme.color2)
  }
  return isColorDark(theme.color1)
}

// ── Particle canvas ───────────────────────────────────────────
function ParticleCanvas({ color }: { color: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    type P = { x: number; y: number; r: number; vx: number; vy: number; o: number }
    const pts: P[] = []
    let raf: number

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      pts.length = 0
      for (let i = 0; i < 70; i++) {
        pts.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          r: Math.random() * 2 + 0.4,
          vx: (Math.random() - 0.5) * 0.35,
          vy: (Math.random() - 0.5) * 0.35,
          o: Math.random() * 0.5 + 0.2,
        })
      }
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const hex = color.replace('#', '')
      const r = parseInt(hex.slice(0, 2), 16)
      const g = parseInt(hex.slice(2, 4), 16)
      const b = parseInt(hex.slice(4, 6), 16)
      for (const p of pts) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${r},${g},${b},${p.o})`
        ctx.fill()
        p.x = (p.x + p.vx + canvas.width) % canvas.width
        p.y = (p.y + p.vy + canvas.height) % canvas.height
      }
      raf = requestAnimationFrame(draw)
    }

    resize()
    draw()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [color])

  return <canvas ref={ref} className="absolute inset-0 h-full w-full pointer-events-none" />
}

// ── Main wrapper ──────────────────────────────────────────────
export default function FormBackground({
  theme,
  children,
}: {
  theme: FormTheme
  children: React.ReactNode
}) {
  const bg = getBackgroundCSS(theme)

  return (
    <div className="relative min-h-screen" style={{ background: bg }}>
      {theme.particles && <ParticleCanvas color={theme.particleColor} />}
      <div className="relative z-10">{children}</div>
    </div>
  )
}
