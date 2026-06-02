'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function AccountPage() {
  const supabase = createClient()

  // ── Current user info ─────────────────────────────────────────
  const [email, setEmailDisplay] = useState('')
  const [displayName, setDisplayNameDisplay] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmailDisplay(data.user?.email ?? '')
      setDisplayNameDisplay(data.user?.user_metadata?.display_name ?? '')
    })
  }, [])

  // ── Display name ──────────────────────────────────────────────
  const [name, setName] = useState('')
  const [nameLoading, setNameLoading] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [nameSuccess, setNameSuccess] = useState(false)

  async function handleChangeName(e: React.FormEvent) {
    e.preventDefault()
    setNameError(null)
    setNameSuccess(false)
    if (!name.trim()) { setNameError('Name cannot be empty.'); return }
    setNameLoading(true)
    const { error } = await supabase.auth.updateUser({ data: { display_name: name.trim() } })
    setNameLoading(false)
    if (error) { setNameError(error.message); return }
    setDisplayNameDisplay(name.trim())
    setNameSuccess(true)
    setName('')
  }

  // ── Change email ──────────────────────────────────────────────
  const [newEmail, setNewEmail] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [emailSuccess, setEmailSuccess] = useState(false)

  async function handleChangeEmail(e: React.FormEvent) {
    e.preventDefault()
    setEmailError(null)
    setEmailSuccess(false)
    setEmailLoading(true)
    const { error } = await supabase.auth.updateUser({ email: newEmail })
    setEmailLoading(false)
    if (error) { setEmailError(error.message); return }
    setEmailSuccess(true)
    setNewEmail('')
  }

  // ── Change password ───────────────────────────────────────────
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwError(null)
    setPwSuccess(false)
    if (newPassword.length < 6) { setPwError('Password must be at least 6 characters.'); return }
    if (newPassword !== confirmPassword) { setPwError('Passwords do not match.'); return }
    setPwLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPwLoading(false)
    if (error) { setPwError(error.message); return }
    setPwSuccess(true)
    setNewPassword('')
    setConfirmPassword('')
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-14 lg:top-0 z-10 bg-white border-b border-[#E5E5E5] px-4 py-4 sm:px-8 sm:py-5">
        <h1 className="text-xl font-semibold text-[#111111]">Account</h1>
        <p className="mt-0.5 text-sm text-muted">Manage your login credentials</p>
      </div>

      <div className="mx-auto max-w-lg px-4 py-8 sm:px-8 space-y-6">

        {/* Current info */}
        <div className="rounded-lg border border-[#E5E5E5] divide-y divide-[#E5E5E5]">
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-widest text-muted">Email</span>
            <span className="text-sm font-medium text-[#111111]">{email || '—'}</span>
          </div>
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-widest text-muted">Display Name</span>
            <span className="text-sm font-medium text-[#111111]">{displayName || '—'}</span>
          </div>
        </div>

        {/* Display name */}
        <Section title="Display Name" description="This name appears in your profile across the dashboard.">
          <form onSubmit={handleChangeName} className="space-y-4">
            <Feedback error={nameError} success={nameSuccess ? 'Display name updated.' : null} />
            <div>
              <Label htmlFor="display-name">New Display Name</Label>
              <Input
                id="display-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. John Doe"
                required
              />
            </div>
            <Button type="submit" disabled={nameLoading}>
              {nameLoading ? 'Saving…' : 'Update Name'}
            </Button>
          </form>
        </Section>

        {/* Change email */}
        <Section title="Email Address" description="After changing, you'll receive a confirmation link at your new address.">
          <form onSubmit={handleChangeEmail} className="space-y-4">
            <Feedback error={emailError} success={emailSuccess ? 'Confirmation sent to your new email. Click the link to verify.' : null} />
            <div>
              <Label htmlFor="new-email">New Email Address</Label>
              <Input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="new@example.com"
                required
              />
            </div>
            <Button type="submit" disabled={emailLoading}>
              {emailLoading ? 'Sending…' : 'Update Email'}
            </Button>
          </form>
        </Section>

        {/* Change password */}
        <Section title="Password" description="Use a strong password of at least 6 characters.">
          <form onSubmit={handleChangePassword} className="space-y-4">
            <Feedback error={pwError} success={pwSuccess ? 'Password updated successfully.' : null} />
            <div>
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 6 characters"
                required
              />
            </div>
            <div>
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat your new password"
                required
              />
            </div>
            <Button type="submit" disabled={pwLoading}>
              {pwLoading ? 'Saving…' : 'Update Password'}
            </Button>
          </form>
        </Section>

      </div>
    </div>
  )
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[#E5E5E5] p-6 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-[#111111]">{title}</h2>
        <p className="mt-0.5 text-xs text-muted">{description}</p>
      </div>
      {children}
    </section>
  )
}

function Feedback({ error, success }: { error: string | null; success: string | null }) {
  if (error) return (
    <div className="rounded-lg border border-error/30 bg-error/5 px-4 py-3 text-sm text-error">{error}</div>
  )
  if (success) return (
    <div className="rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">{success}</div>
  )
  return null
}
