'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'

function Loader() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/60 backdrop-blur-[2px]">
      <div className="relative" style={{ width: 65, height: 65 }}>
        <span className="absolute rounded-[8px]" style={{ animation: 'navLoaderAnim 2.5s infinite', boxShadow: 'inset 0 0 0 3px #111111' }} />
        <span className="absolute rounded-[8px]" style={{ animation: 'navLoaderAnim 2.5s infinite', animationDelay: '-1.25s', boxShadow: 'inset 0 0 0 3px #111111' }} />
        <style>{`
          @keyframes navLoaderAnim {
            0%    { inset: 0 35px 35px 0; }
            12.5% { inset: 0 35px 0 0; }
            25%   { inset: 35px 35px 0 0; }
            37.5% { inset: 35px 0 0 0; }
            50%   { inset: 35px 0 0 35px; }
            62.5% { inset: 0 0 0 35px; }
            75%   { inset: 0 0 35px 35px; }
            87.5% { inset: 0 0 35px 0; }
            100%  { inset: 0 35px 35px 0; }
          }
        `}</style>
      </div>
    </div>
  )
}

function NavigationLoaderInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)

  // Hide loader when navigation completes (pathname/search changes)
  useEffect(() => {
    setLoading(false)
  }, [pathname, searchParams])

  // Show loader when an internal link is clicked
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a')
      if (!anchor) return

      const href = anchor.getAttribute('href')
      if (!href) return

      // Skip: external links, hash-only, new tab, download
      if (
        href.startsWith('http') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('#') ||
        anchor.target === '_blank' ||
        anchor.hasAttribute('download') ||
        e.ctrlKey || e.metaKey || e.shiftKey
      ) return

      setLoading(true)
    }

    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  if (!loading) return null
  return <Loader />
}

export default function NavigationLoader() {
  return (
    <Suspense>
      <NavigationLoaderInner />
    </Suspense>
  )
}
