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

    // Fallback: server-generated invite codes don't have a client-side verifier.
    // Use the service client which can exchange without one.
    const admin = createServiceClient()
    const { error: adminError } = await admin.auth.exchangeCodeForSession(code)

    if (!adminError) {
      const destination = type === 'invite' ? '/auth/set-password' : next
      return NextResponse.redirect(`${origin}${destination}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=invalid_link`)
}
