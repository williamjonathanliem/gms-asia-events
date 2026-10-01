'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function AccountPage() {
  const supabase = createClient()

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

  const initial = email ? email.charAt(0).toUpperCase() : '?'

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-14 lg:top-0 z-10 bg-white border-b border-[#E5E5E5] px-6 py-4 sm:px-10 sm:py-5">
        <h1 className="text-xl font-semibold text-[#111111]">Settings</h1>
        <p className="mt-0.5 text-sm text-muted">Manage your login credentials</p>
      </div>

      <div className="px-6 sm:px-10 py-8 max-w-5xl space-y-0">

        {/* Profile summary — avatar + current info side by side */}
        <div className="flex items-center gap-5 pb-8 border-b border-[#E5E5E5]">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[#111111] text-xl font-semibold text-white select-none">
            {initial}
          </div>
          <div>
            <p className="text-base font-semibold text-[#111111]">{displayName || <span className="text-muted font-normal italic">No display name set</span>}</p>
            <p className="text-sm text-muted mt-0.5">{email}</p>
          </div>
        </div>

        {/* Display name row */}
        <SettingsRow
          title="Display Name"
          description="Shown in your profile across the dashboard."
        >
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
        </SettingsRow>

        {/* Email row */}
        <SettingsRow
          title="Email Address"
          description="After changing, you'll receive a confirmation link at your new address."
        >
          <form onSubmit={handleChangeEmail} className="space-y-4">
            <Feedback error={emailError} success={emailSuccess ? 'Confirmation sent. Click the link to verify.' : null} />
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
        </SettingsRow>

        {/* Password row */}
        <SettingsRow
          title="Password"
          description="Use a strong password of at least 6 characters."
          last
        >
          <form onSubmit={handleChangePassword} className="space-y-4">
            <Feedback error={pwError} success={pwSuccess ? 'Password updated successfully.' : null} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your new password"
                  required
                />
              </div>
            </div>
            <Button type="submit" disabled={pwLoading}>
              {pwLoading ? 'Saving…' : 'Update Password'}
            </Button>
          </form>
        </SettingsRow>

      </div>
    </div>
  )
}

function SettingsRow({
  title,
  description,
  children,
  last = false,
}: {
  title: string
  description: string
  children: React.ReactNode
  last?: boolean
}) {
  return (
    <div className={`grid grid-cols-1 gap-6 py-8 lg:grid-cols-[280px_1fr] ${!last ? 'border-b border-[#E5E5E5]' : ''}`}>
      <div className="lg:pr-8">
        <h2 className="text-sm font-semibold text-[#111111]">{title}</h2>
        <p className="mt-1 text-sm text-muted leading-relaxed">{description}</p>
      </div>
      <div className="max-w-md">
        {children}
      </div>
    </div>
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
