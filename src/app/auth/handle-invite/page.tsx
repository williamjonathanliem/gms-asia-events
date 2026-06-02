'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function HandleInvitePage() {
  const supabase = createClient()
  const router = useRouter()
  const [status, setStatus] = useState('Processing your invite…')

  useEffect(() => {
    async function processInvite() {
      // ── 1. Hash fragment (implicit flow) ────────────────────────
      // Supabase redirects with #access_token=...&refresh_token=...&type=invite
      const hash = window.location.hash.substring(1)
      if (hash) {
        const params = new URLSearchParams(hash)
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
          if (!error) {
            router.replace('/auth/set-password')
            return
          }
        }
      }

      // ── 2. PKCE code flow (query param) ─────────────────────────
      const searchParams = new URLSearchParams(window.location.search)
      const code = searchParams.get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
          router.replace('/auth/set-password')
          return
        }
      }

      // ── 3. Session already exists (page reloaded after partial flow) ─
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        router.replace('/auth/set-password')
        return
      }

      // Nothing worked
      setStatus('This invite link has expired or is invalid. Please ask your admin to send a new invite.')
    }

    processInvite()
  }, [])

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6">
      <div className="text-center space-y-3">
        <div className="mx-auto size-8 animate-spin rounded-full border-2 border-[#E5E5E5] border-t-[#111111]" />
        <p className="text-sm text-muted max-w-sm">{status}</p>
      </div>
    </main>
  )
}
