import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// TEMPORARY — delete after resetting passwords
export async function PATCH(req: Request) {
  const { user_id, new_password } = await req.json()
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { error } = await sb.auth.admin.updateUserById(user_id, { password: new_password })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
