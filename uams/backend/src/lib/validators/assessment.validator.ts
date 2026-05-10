import { z } from 'zod'

export const componentTypes = [
  'quiz', 'assignment', 'midterm', 'final', 'lab', 'project', 'presentation', 'other',
] as const

// ── Assessment Plans ──────────────────────────────────────────────────────────

export const createAssessmentPlanSchema = z.object({
  courseId:          z.string().uuid(),
  academicSessionId: z.string().uuid(),
})

// ── Assessment Components ─────────────────────────────────────────────────────

export const createComponentSchema = z.object({
  name:             z.string().min(1).max(100),
  componentType:    z.enum(componentTypes),
  weightPercentage: z.number().min(0.01).max(100),
  totalMarks:       z.number().int().min(1).default(100),
  assessmentCount:  z.number().int().min(1).default(1),
  cloMapped:        z.boolean().default(false),
})

export const updateComponentSchema = createComponentSchema.partial()

// ── CLO Links ─────────────────────────────────────────────────────────────────

export const addCloLinkSchema = z.object({
  cloId:  z.string().uuid(),
  weight: z.number().min(0.01).max(100).default(100),
})

// ── Copy Plan ─────────────────────────────────────────────────────────────────

export const copyAssessmentPlanSchema = z.object({
  courseId:        z.string().uuid(),
  sourceSessionId: z.string().uuid(),
  targetSessionId: z.string().uuid(),
})

// ── Types ─────────────────────────────────────────────────────────────────────

export type CreateAssessmentPlanInput = z.infer<typeof createAssessmentPlanSchema>
export type CopyAssessmentPlanInput   = z.infer<typeof copyAssessmentPlanSchema>
export type CreateComponentInput      = z.infer<typeof createComponentSchema>
export type UpdateComponentInput      = z.infer<typeof updateComponentSchema>
export type AddCloLinkInput           = z.infer<typeof addCloLinkSchema>
