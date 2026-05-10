import { z } from 'zod'

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')

export const createSemesterOfferingSchema = z.object({
  programId:  z.string().uuid(),
  sessionId:  z.string().uuid(),
  semesterNo: z.number().int().min(1).max(16),
  status:     z.enum(['planned', 'active', 'completed']).default('planned'),
  startDate:  dateStr.nullable().optional(),
  endDate:    dateStr.nullable().optional(),
})

export const updateSemesterOfferingSchema = z.object({
  status:    z.enum(['planned', 'active', 'completed']).optional(),
  startDate: dateStr.nullable().optional(),
  endDate:   dateStr.nullable().optional(),
})

export const createCourseOfferingSchema = z.object({
  semesterOfferingId: z.string().uuid(),
  courseId:           z.string().uuid(),
  batchId:            z.string().uuid().nullable().optional(),
  capacity:           z.number().int().min(1).nullable().optional(),
  teacherId:          z.string().uuid().nullable().optional(),
  scheduleInfo:       z.record(z.string(), z.unknown()).nullable().optional(),
})

export const updateCourseOfferingSchema = z.object({
  batchId:      z.string().uuid().nullable().optional(),
  capacity:     z.number().int().min(1).nullable().optional(),
  teacherId:    z.string().uuid().nullable().optional(),
  scheduleInfo: z.record(z.string(), z.unknown()).nullable().optional(),
})

export const bulkSaveCourseOfferingsSchema = z.object({
  semesterOfferingId: z.string().uuid(),
  courses: z.array(z.object({
    courseId:     z.string().uuid(),
    batchId:      z.string().uuid().nullable().optional(),
    capacity:     z.number().int().min(1).nullable().optional(),
    teacherId:    z.string().uuid().nullable().optional(),
    scheduleInfo: z.record(z.string(), z.unknown()).nullable().optional(),
  })).min(1),
})

export type CreateSemesterOfferingInput  = z.infer<typeof createSemesterOfferingSchema>
export type UpdateSemesterOfferingInput  = z.infer<typeof updateSemesterOfferingSchema>
export type CreateCourseOfferingInput    = z.infer<typeof createCourseOfferingSchema>
export type UpdateCourseOfferingInput    = z.infer<typeof updateCourseOfferingSchema>
export type BulkSaveCourseOfferingsInput = z.infer<typeof bulkSaveCourseOfferingsSchema>
