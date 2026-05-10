import { z } from 'zod'

const bloomsLevels = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'] as const

// ── CLO ───────────────────────────────────────────────────────────────────────

export const createCloSchema = z.object({
  courseId:    z.string().uuid(),
  description: z.string().min(1).max(1000),
  bloomsLevel: z.enum(bloomsLevels).optional(),
})

export const updateCloSchema = z.object({
  description: z.string().min(1).max(1000).optional(),
  bloomsLevel: z.enum(bloomsLevels).nullable().optional(),
})

// ── PLO ───────────────────────────────────────────────────────────────────────

export const createPloSchema = z.object({
  programId:   z.string().uuid(),
  description: z.string().min(1).max(1000),
})

export const updatePloSchema = z.object({
  description: z.string().min(1).max(1000).optional(),
})

// ── Mapping ───────────────────────────────────────────────────────────────────

export const createMappingSchema = z.object({
  cloId:  z.string().uuid(),
  ploId:  z.string().uuid(),
  weight: z.number().min(0).max(1),
})

export const updateMappingSchema = z.object({
  weight: z.number().min(0).max(1),
})

// ── Types ─────────────────────────────────────────────────────────────────────

export type CreateCloInput     = z.infer<typeof createCloSchema>
export type UpdateCloInput     = z.infer<typeof updateCloSchema>
export type CreatePloInput     = z.infer<typeof createPloSchema>
export type UpdatePloInput     = z.infer<typeof updatePloSchema>
export type CreateMappingInput = z.infer<typeof createMappingSchema>
export type UpdateMappingInput = z.infer<typeof updateMappingSchema>
