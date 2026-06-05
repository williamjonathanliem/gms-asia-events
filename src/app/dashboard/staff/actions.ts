'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentStaffUser } from '@/lib/supabase/auth'
import { getTransporter, FROM } from '@/lib/email/transporter'
import { revalidatePath } from 'next/cache'
import type { StaffRole } from '@/lib/types/database'

async function requireSuperAdmin() {
  const staff = await getCurrentStaffUser()
  if (staff?.role !== 'super_admin') throw new Error('Unauthorised')
}

export async function inviteStaff(data: {
  email: string
  role: StaffRole
  event_scope: string | null
}): Promise<{ error?: string }> {
  try {
    await requireSuperAdmin()
    const supabase = createServiceClient()

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      'http://localhost:3000'

    const email = data.email.trim().toLowerCase()

    // Step 1: Generate invite link — creates the user AND returns a PKCE link, no email sent
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'invite',
      email,
      options: { redirectTo: `${origin}/auth/handle-invite` },
    })

    if (linkError) return { error: linkError.message }

    const inviteLink = linkData?.properties?.action_link
    const userId = linkData?.user?.id
    if (!inviteLink || !userId) return { error: 'Failed to generate invite link.' }

    // Step 2: Create staff_users record
    const { error: insertError } = await supabase.from('staff_users').upsert(
      {
        id: userId,
        email,
        role: data.role,
        event_scope: data.event_scope || null,
      },
      { onConflict: 'id' }
    )

    if (insertError) return { error: insertError.message }

    // Step 4: Send invite email via our own Nodemailer — no Supabase rate limits
    await getTransporter().sendMail({
      from: FROM(),
      to: email,
      subject: 'Welcome Aboard the Team! — GMS Asia Events Management',
      html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;border:1px solid #E5E5E5;overflow:hidden;">
        <tr>
          <td style="padding:28px 36px;border-bottom:1px solid #E5E5E5;">
            <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6B6B6B;">GMS Events</p>
            <p style="margin:0;font-size:18px;font-weight:600;color:#111111;">You've been invited to the team</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 36px;">
            <p style="margin:0 0 20px;font-size:13px;color:#444444;line-height:1.6;">
              You've been added as a staff member on <strong style="color:#111111;">GMS Asia Events</strong>. Click the button below to set up your password and access the dashboard.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin:28px 0;">
              <tr>
                <td style="background:#111111;border-radius:6px;">
                  <a href="${inviteLink}" style="display:inline-block;padding:12px 28px;font-size:13px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.01em;">
                    Accept Invitation →
                  </a>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E5E5;border-radius:8px;margin-bottom:24px;">
              <tr>
                <td style="padding:14px 18px;border-bottom:1px solid #E5E5E5;">
                  <p style="margin:0 0 3px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;color:#6B6B6B;">What happens next</p>
                  <p style="margin:0;font-size:13px;color:#111111;">You will be asked to set a password before being taken to the dashboard.</p>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 18px;">
                  <p style="margin:0 0 3px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;color:#6B6B6B;">Link expires</p>
                  <p style="margin:0;font-size:13px;color:#111111;">This link is valid for 24 hours. Ask your admin to resend if it expires.</p>
                </td>
              </tr>
            </table>
            <p style="margin:0;font-size:12px;color:#6B6B6B;line-height:1.6;">If you were not expecting this invitation, you can safely ignore this email.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 36px;border-top:1px solid #E5E5E5;background:#fafafa;">
            <p style="margin:0;font-size:11px;color:#6B6B6B;">This is an automated message from GMS Asia Events. Please do not reply to this email.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    })

    revalidatePath('/dashboard/staff')
    return {}
  } catch (e: any) {
    return { error: e.message }
  }
}

export async function updateStaffMember(
  id: string,
  data: { role: StaffRole; event_scope: string | null }
): Promise<{ error?: string }> {
  try {
    await requireSuperAdmin()
    const supabase = createServiceClient()

    // Prevent demoting the last super_admin
    if (data.role !== 'super_admin') {
      const { count } = await supabase
        .from('staff_users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'super_admin')
      if ((count ?? 0) <= 1) {
        const { data: target } = await supabase
          .from('staff_users')
          .select('role')
          .eq('id', id)
          .single()
        if (target?.role === 'super_admin') {
          return { error: 'Cannot demote the last super admin.' }
        }
      }
    }

    const { error } = await supabase
      .from('staff_users')
      .update({ role: data.role, event_scope: data.event_scope || null })
      .eq('id', id)

    if (error) return { error: error.message }
    revalidatePath('/dashboard/staff')
    return {}
  } catch (e: any) {
    return { error: e.message }
  }
}

export async function removeStaff(id: string): Promise<{ error?: string; authWarning?: boolean }> {
  try {
    await requireSuperAdmin()
    const supabase = createServiceClient()

    // Prevent removing the last super_admin
    const { count } = await supabase
      .from('staff_users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'super_admin')

    if ((count ?? 0) <= 1) {
      const { data: target } = await supabase
        .from('staff_users')
        .select('role')
        .eq('id', id)
        .single()
      if (target?.role === 'super_admin') {
        return { error: 'Cannot remove the last super admin.' }
      }
    }

    // Step 1: Remove dashboard access — explicit delete so it always works
    // regardless of whether the FK cascade is configured in Supabase.
    const { error: staffError } = await supabase
      .from('staff_users')
      .delete()
      .eq('id', id)

    if (staffError) return { error: staffError.message }

    // Step 2: Delete auth user to revoke login credentials.
    // Non-fatal: if this fails the person still cannot access the dashboard
    // (staff_users row is gone) but their email/password remains in Supabase Auth.
    const { error: authError } = await supabase.auth.admin.deleteUser(id)

    revalidatePath('/dashboard/staff')
    return authError ? { authWarning: true } : {}
  } catch (e: any) {
    return { error: e.message }
  }
}
