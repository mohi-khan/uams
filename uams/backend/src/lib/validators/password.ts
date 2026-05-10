import { z } from 'zod'

export const passwordSchema = z
  .string()
  .min(8,   'Password must be at least 8 characters')
  .max(100, 'Password must not exceed 100 characters')
  .refine((v) => /[A-Z]/.test(v),         'Must contain at least one uppercase letter')
  .refine((v) => /[a-z]/.test(v),         'Must contain at least one lowercase letter')
  .refine((v) => /[0-9]/.test(v),         'Must contain at least one number')
  .refine((v) => /[^A-Za-z0-9]/.test(v), 'Must contain at least one special character (@, #, $, !, etc.)')
