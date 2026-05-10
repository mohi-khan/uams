import { z } from 'zod'

export const loginSchema = z.object({
  email:    z.email(),
  password: z.string().min(1, 'Password is required'),
})

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
})

export const activateInvitationSchema = z.object({
  token:    z.string().min(1),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export const googleIdTokenSchema = z.object({
  idToken: z.string().min(1),
})

export type LoginInput              = z.infer<typeof loginSchema>
export type RefreshInput            = z.infer<typeof refreshSchema>
export type ActivateInvitationInput = z.infer<typeof activateInvitationSchema>
export type GoogleIdTokenInput      = z.infer<typeof googleIdTokenSchema>
