'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

interface SignInState {
  error?: string
}

export async function signIn(
  _prev: SignInState,
  formData: FormData
): Promise<SignInState> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const next = (formData.get('next') as string) || '/dashboard'

  const supabase = createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: error.message }
  }

  // Send scanners straight to the scanner — skip the dashboard entirely
  if (next === '/dashboard') {
    const admin = createServiceClient()
    const { data: staffData } = await admin
      .from('staff_users')
      .select('role')
      .eq('id', data.user.id)
      .single()

    if (staffData?.role === 'scanner') {
      redirect('/dashboard/scanner')
    }
  }

  redirect(next)
}

export async function signOut() {
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/auth/login')
}
