import { z } from 'zod'
import { passwordSchema } from './password'

export const registerTenantSchema = z.object({
  // University info
  universityName:  z.string().min(3).max(255),
  universityEmail: z.email(),
  phone:           z.string().min(7).max(50).optional(),
  address:         z.string().max(500).optional(),
  city:            z.string().max(100).optional(),
  country:         z.string().max(100),
  tier:            z.enum(['0-50', '51-100', '101-500', '501-1000', '1001+']),

  // First admin account
  firstName:  z.string().min(1).max(100),
  lastName:   z.string().min(1).max(100),
  adminEmail: z.email(),
  password:   passwordSchema,
})

export type RegisterTenantInput = z.infer<typeof registerTenantSchema>
