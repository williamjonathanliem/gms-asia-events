'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { signIn } from './actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import InstallButton from '@/components/pwa/InstallButton'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? (
        <span className="flex items-center gap-2">
          <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Signing in…
        </span>
      ) : (
        'Sign In'
      )}
    </Button>
  )
}

function LoginForm() {
  const [state, action] = useFormState(signIn, {})
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/dashboard'

  return (
    <form action={action} className="space-y-5">
      {state.error && (
        <div className="rounded-lg border border-error/30 bg-error/5 px-4 py-3 text-sm text-error">
          {state.error}
        </div>
      )}

      <div>
        <Label htmlFor="email" required>Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <Label htmlFor="password" required>Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
        />
      </div>

      <input type="hidden" name="next" value={next} />

      <SubmitButton />
    </form>
  )
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">
            GMS Events
          </p>
          <h1 className="mt-2 text-xl font-semibold text-[#111111]">Staff Sign In</h1>
          <p className="mt-1 text-sm text-muted">
            Dashboard access is restricted to authorised staff.
          </p>
        </div>

        <Suspense>
          <LoginForm />
        </Suspense>

        <InstallButton variant="banner" />
      </div>
    </main>
  )
}
