import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

// Handles Supabase email links — invite acceptance, password reset, magic link
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'
  const type = searchParams.get('type') // 'invite' when coming from a staff invite email

  if (code) {
    // Try normal client first (works when code_verifier cookie exists)
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const destination = type === 'invite' ? '/auth/set-password' : next
      return NextResponse.redirect(`${origin}${destination}`)
    }

    // Fallback: server-generated invite codes don't have a client-side PKCE verifier.
    // Exchange via service client, then hydrate the SSR client so cookies are set.
    const admin = createServiceClient()
    const { data: adminData, error: adminError } = await admin.auth.exchangeCodeForSession(code)

    if (!adminError && adminData.session) {
      // Write the session into SSR cookies so the redirect lands with a valid session
      await supabase.auth.setSession({
        access_token:  adminData.session.access_token,
        refresh_token: adminData.session.refresh_token,
      })
      const destination = type === 'invite' ? '/auth/set-password' : next
      return NextResponse.redirect(`${origin}${destination}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=invalid_link`)
}
