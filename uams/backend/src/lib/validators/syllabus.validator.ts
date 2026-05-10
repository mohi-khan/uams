import { z } from 'zod'

export const createSyllabusSchema = z.object({
  courseId: z.string().uuid(),
})

export const upsertTopicSchema = z.object({
  title:          z.string().min(1).max(255),
  description:    z.string().max(2000).nullable().optional(),
  orderNo:        z.number().int().min(0).optional(),
  estimatedHours: z.number().min(0).max(999).nullable().optional(),
})

export const updateTopicSchema = upsertTopicSchema.partial()

export const reorderTopicsSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1),
})

export type CreateSyllabusInput = z.infer<typeof createSyllabusSchema>
export type UpsertTopicInput    = z.infer<typeof upsertTopicSchema>
export type UpdateTopicInput    = z.infer<typeof updateTopicSchema>
export type ReorderTopicsInput  = z.infer<typeof reorderTopicsSchema>
