'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function SetPasswordPage() {
  const supabase = createClient()
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)

  // Wait for session to be available before allowing form submission
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSessionReady(true)
      } else {
        // No session — invite link may have expired
        setError('Your invitation link has expired or is invalid. Please ask your admin to send a new invite.')
      }
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const { data, error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setError(error.message || 'Failed to set password. Please try again.')
      return
    }

    if (!data?.user) {
      setError('Something went wrong. Please try again.')
      return
    }

    router.push('/dashboard')
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">
            GMS Events
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-[#111111]">Set your password</h1>
          <p className="mt-1 text-sm text-muted">
            Choose a password to secure your staff account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-lg border border-error/30 bg-error/5 px-4 py-3 text-sm text-error">
              {error}
            </div>
          )}

          <div>
            <Label htmlFor="password">New Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              required
              autoFocus
              disabled={!sessionReady}
            />
          </div>

          <div>
            <Label htmlFor="confirm">Confirm Password</Label>
            <Input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat your password"
              required
              disabled={!sessionReady}
            />
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={loading || !sessionReady}
          >
            {loading ? 'Saving…' : 'Set Password & Continue'}
          </Button>
        </form>
      </div>
    </main>
  )
}
