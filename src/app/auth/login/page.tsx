'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { signIn } from './actions'
import { useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import InstallButton from '@/components/pwa/InstallButton'
import Image from 'next/image'

function PasswordField() {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        id="password"
        name="password"
        type={show ? 'text' : 'password'}
        autoComplete="current-password"
        required
        placeholder="Password"
        className="h-10 w-full rounded-md border border-[#E5E5E5] bg-white px-3 pr-10 text-sm text-[#111111] placeholder:text-[#999] outline-none transition focus:border-[#111111] focus:ring-2 focus:ring-[#111111]/10"
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        tabIndex={-1}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#999] transition-colors hover:text-[#111111]"
      >
        {show ? (
          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
          </svg>
        ) : (
          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        )}
      </button>
    </div>
  )
}

function ButtonLoader() {
  return (
    <span className="relative inline-block" style={{ width: 18, height: 18 }}>
      <span className="absolute rounded-[4px]" style={{ animation: 'loginLoaderAnim 2.5s infinite', boxShadow: 'inset 0 0 0 2px white' }} />
      <span className="absolute rounded-[4px]" style={{ animation: 'loginLoaderAnim 2.5s infinite', animationDelay: '-1.25s', boxShadow: 'inset 0 0 0 2px white' }} />
      <style>{`
        @keyframes loginLoaderAnim {
          0%    { inset: 0 9px 9px 0; }
          12.5% { inset: 0 9px 0 0; }
          25%   { inset: 9px 9px 0 0; }
          37.5% { inset: 9px 0 0 0; }
          50%   { inset: 9px 0 0 9px; }
          62.5% { inset: 0 0 0 9px; }
          75%   { inset: 0 0 9px 9px; }
          87.5% { inset: 0 0 9px 0; }
          100%  { inset: 0 9px 9px 0; }
        }
      `}</style>
    </span>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#111111] text-sm font-semibold text-white transition hover:bg-[#2a2a2a] disabled:opacity-60"
    >
      {pending && <ButtonLoader />}
      {pending ? 'Signing in...' : 'Sign In'}
    </button>
  )
}

function LoginForm() {
  const [state, action] = useFormState(signIn, {})
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/dashboard'

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <div className="flex items-start gap-2.5 rounded-md border border-red-200 bg-red-50 px-3 py-2.5">
          <svg className="mt-0.5 size-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="text-sm text-red-600">{state.error}</p>
        </div>
      )}

      <div className="space-y-1">
        <label htmlFor="email" className="block text-sm font-medium text-[#111111]">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          required
          placeholder="you@gms.org"
          className="h-10 w-full rounded-md border border-[#E5E5E5] bg-white px-3 text-sm text-[#111111] placeholder:text-[#999] outline-none transition focus:border-[#111111] focus:ring-2 focus:ring-[#111111]/10"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="password" className="block text-sm font-medium text-[#111111]">Password</label>
        <PasswordField />
      </div>

      <input type="hidden" name="next" value={next} />

      <SubmitButton />
    </form>
  )
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#fafafa] px-4 py-12">
      <div className="w-full max-w-sm space-y-6">

        {/* Logo + title */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="overflow-hidden rounded-xl border border-[#E5E5E5] shadow-sm">
            <Image src="/gmschurch_logo.jpg" alt="GMS" width={56} height={56} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[#111111]">GMS Events</h1>
            <p className="text-sm text-[#666]">Staff sign in</p>
          </div>
        </div>

        {/* Form card */}
        <div className="rounded-xl border border-[#E5E5E5] bg-white p-6 shadow-sm">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>

        <InstallButton variant="banner" />

      </div>
    </main>
  )
}
