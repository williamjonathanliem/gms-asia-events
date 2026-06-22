import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

const SKIP_LOG = /^\/(api\/|_next\/|favicon|.*\.(ico|png|jpg|jpeg|svg|webp|css|js|woff2?))/

function logAccess(request: NextRequest, user: { id: string; email?: string } | null, status = 200) {
  if (SKIP_LOG.test(request.nextUrl.pathname)) return
  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    null
  serviceClient.from('access_logs').insert({
    path:        request.nextUrl.pathname + (request.nextUrl.search || ''),
    method:      request.method,
    ip,
    country:     request.geo?.country ?? null,
    user_agent:  request.headers.get('user-agent'),
    referer:     request.headers.get('referer'),
    staff_id:    user?.id ?? null,
    staff_email: user?.email ?? null,
    status,
  }).then() // fire-and-forget, never await
}

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

  // Refresh session — must be called before any route check
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const isProtected =
    pathname.startsWith('/dashboard') || pathname.startsWith('/scan')

  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/auth/login'
    loginUrl.searchParams.set('next', pathname)
    logAccess(request, null, 302)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect authenticated users away from login
  if (pathname === '/auth/login' && user) {
    const dashboardUrl = request.nextUrl.clone()
    dashboardUrl.pathname = '/dashboard'
    logAccess(request, user, 302)
    return NextResponse.redirect(dashboardUrl)
  }

  logAccess(request, user)
  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
