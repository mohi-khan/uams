import { Resend } from 'resend'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

export async function sendVerificationEmail(to: string, universityName: string, token: string) {
  const verifyUrl = `${process.env.FRONTEND_URL}/verify?token=${token}`

  const { data, error } = await getResend().emails.send({
    from: process.env.RESEND_FROM!,
    to,
    subject: 'Verify your UAMS account',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to UAMS</h2>
        <p>Hi, thank you for registering <strong>${universityName}</strong>.</p>
        <p>Please verify your email address to activate your account.</p>
        <p>This link expires in <strong>24 hours</strong>.</p>
        <a href="${verifyUrl}"
           style="display:inline-block;padding:12px 24px;background:#4F46E5;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">
          Verify Email
        </a>
        <p style="margin-top:24px;color:#6B7280;font-size:13px;">
          Or copy this link: ${verifyUrl}
        </p>
      </div>
    `,
  })

  if (error) {
    console.error('Resend error:', error)
    throw new Error(`Failed to send verification email: ${error.message}`)
  }

  console.log('Verification email sent, id:', data?.id)
}

export async function sendTeacherInvitationEmail(
  to: string,
  teacherName: string,
  universityName: string,
  token: string,
) {
  const activateUrl = `${process.env.FRONTEND_URL}/activate?token=${token}`

  const { data, error } = await getResend().emails.send({
    from: process.env.RESEND_FROM!,
    to,
    subject: `You've been invited to join ${universityName} on UAMS`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to UAMS, ${teacherName}!</h2>
        <p>You have been added as a <strong>Teacher</strong> at <strong>${universityName}</strong>.</p>
        <p>Click the button below to activate your account and set your password.</p>
        <p>This link expires in <strong>24 hours</strong>.</p>
        <a href="${activateUrl}"
           style="display:inline-block;padding:12px 24px;background:#4F46E5;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">
          Activate Account
        </a>
        <p style="margin-top:24px;color:#6B7280;font-size:13px;">
          Or copy this link: ${activateUrl}
        </p>
        <p style="color:#6B7280;font-size:12px;">If you did not expect this invitation, please ignore this email.</p>
      </div>
    `,
  })

  if (error) {
    console.error('Resend error:', error)
    throw new Error(`Failed to send invitation email: ${error.message}`)
  }

  console.log('Teacher invitation email sent, id:', data?.id)
}
