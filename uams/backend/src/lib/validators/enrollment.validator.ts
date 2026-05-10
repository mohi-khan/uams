import { z } from 'zod'

// ── Student ───────────────────────────────────────────────────────────────────

export const createStudentSchema = z.object({
  studentCode:    z.string().min(1).max(50),
  name:           z.string().min(2).max(255),
  email:          z.string().email().toLowerCase(),
  gmailAccount:   z.string().email().toLowerCase(),
  phone:          z.string().max(30).optional(),
  address:        z.string().max(1000).optional(),
  emergencyPhone: z.string().max(30).optional(),
  nidBirthReg:    z.string().max(100).optional(),
  photoUrl:       z.string().max(500).optional(),
})

export const updateStudentSchema = z.object({
  studentCode:    z.string().min(1).max(50).optional(),
  name:           z.string().min(2).max(255).optional(),
  gmailAccount:   z.string().email().toLowerCase().optional(),
  phone:          z.string().max(30).nullable().optional(),
  address:        z.string().max(1000).nullable().optional(),
  emergencyPhone: z.string().max(30).nullable().optional(),
  nidBirthReg:    z.string().max(100).nullable().optional(),
  photoUrl:       z.string().max(500).nullable().optional(),
  isActive:       z.boolean().optional(),
})

export const photoUploadSchema = z.object({
  filename:    z.string().min(1).max(255),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
})

export type CreateStudentInput  = z.infer<typeof createStudentSchema>
export type UpdateStudentInput  = z.infer<typeof updateStudentSchema>
export type PhotoUploadInput    = z.infer<typeof photoUploadSchema>

// ── Batch ─────────────────────────────────────────────────────────────────────

export const createBatchSchema = z.object({
  programId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
  code:      z.string().min(1).max(50),
  name:      z.string().min(2).max(255),
  capacity:  z.number().int().min(1).optional(),
})

export const updateBatchSchema = z.object({
  programId: z.string().uuid().optional(),
  sessionId: z.string().uuid().nullable().optional(),
  code:      z.string().min(1).max(50).optional(),
  name:      z.string().min(2).max(255).optional(),
  capacity:  z.number().int().min(1).nullable().optional(),
  isActive:  z.boolean().optional(),
})

export type CreateBatchInput = z.infer<typeof createBatchSchema>
export type UpdateBatchInput = z.infer<typeof updateBatchSchema>

// ── NID reveal ────────────────────────────────────────────────────────────────

export const revealNidSchema = z.object({
  password: z.string().min(1, 'Password is required'),
})

export type RevealNidInput = z.infer<typeof revealNidSchema>
