import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const SESSION_MAX_AGE_MS = 3 * 60 * 60 * 1000
const ACTIVITY_COOKIE = 'last_activity'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[]
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  let {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Idle timeout: refresh tokens are long-lived, so track last activity ourselves.
  let sessionExpired = false
  if (user) {
    const last = Number(request.cookies.get(ACTIVITY_COOKIE)?.value)
    if (last && Date.now() - last > SESSION_MAX_AGE_MS) {
      await supabase.auth.signOut()
      user = null
      sessionExpired = true
      supabaseResponse.cookies.delete(ACTIVITY_COOKIE)
    } else {
      supabaseResponse.cookies.set(ACTIVITY_COOKIE, String(Date.now()), {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      })
    }
  }

  const isProtected =
    pathname.startsWith('/dashboard') || pathname.startsWith('/scan')

  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/auth/login'
    loginUrl.searchParams.set('next', pathname)
    if (sessionExpired) loginUrl.searchParams.set('expired', '1')
    const redirectRes = NextResponse.redirect(loginUrl)
    supabaseResponse.cookies.getAll().forEach((c) => redirectRes.cookies.set(c))
    return redirectRes
  }

  if (pathname === '/auth/login' && user) {
    const dashboardUrl = request.nextUrl.clone()
    dashboardUrl.pathname = '/dashboard'
    return NextResponse.redirect(dashboardUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
