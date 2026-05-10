import { z } from 'zod'
import { passwordSchema } from './password'

export const createUserSchema = z.object({
  firstName:    z.string().min(1).max(100),
  lastName:     z.string().min(1).max(100),
  email:        z.email(),
  role:         z.enum(['admin', 'dean', 'academic_coordinator', 'teacher', 'student']),
  authProvider: z.enum(['email', 'google']).default('email'),
  password:     passwordSchema.optional(),
}).refine(
  (d) => d.authProvider === 'google' || (d.authProvider === 'email' && !!d.password),
  { message: 'Password is required for email auth', path: ['password'] }
)

export const updateStatusSchema = z.object({
  status: z.enum(['active', 'inactive', 'suspended']),
})

export const resetPasswordSchema = z.object({
  newPassword: passwordSchema,
})

export type CreateUserInput   = z.infer<typeof createUserSchema>
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
