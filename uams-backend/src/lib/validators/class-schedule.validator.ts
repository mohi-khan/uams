import { z } from 'zod'

export const DAY_OF_WEEK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const
export const SCHEDULE_STATUS = ['SCHEDULED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED'] as const

// Single schedule row (from preview → bulk create)
export const scheduleRowSchema = z.object({
  sessionDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  dayOfWeek:       z.enum(DAY_OF_WEEK),
  timeSlotId:      z.string().uuid(),
  roomId:          z.string().uuid().nullable().optional(),
  syllabusTopicId: z.string().uuid().nullable().optional(),
  topicId:         z.string().uuid().nullable().optional(),
  isMakeupClass:   z.boolean().default(false),
  notes:           z.string().max(500).optional(),
})

// Bulk create from pattern submission
export const bulkCreateSchedulesSchema = z.object({
  courseOfferingId: z.string().uuid(),
  rows:             z.array(scheduleRowSchema).min(1).max(500),
})

// Conflict check — same shape as bulk create, used before submitting
export const checkConflictsSchema = z.object({
  courseOfferingId: z.string().uuid(),
  rows: z.array(z.object({
    sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    dayOfWeek:   z.enum(DAY_OF_WEEK),
    timeSlotId:  z.string().uuid(),
    roomId:      z.string().uuid().nullable().optional(),
  })).min(1).max(500),
})

// Update a single scheduled class
export const updateScheduleSchema = z.object({
  timeSlotId:      z.string().uuid().optional(),
  roomId:          z.string().uuid().nullable().optional(),
  sessionDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status:          z.enum(SCHEDULE_STATUS).optional(),
  syllabusTopicId: z.string().uuid().nullable().optional(),
  topicId:         z.string().uuid().nullable().optional(),
  notes:           z.string().max(500).nullable().optional(),
})

export type BulkCreateSchedulesInput = z.infer<typeof bulkCreateSchedulesSchema>
export type CheckConflictsInput      = z.infer<typeof checkConflictsSchema>
export type UpdateScheduleInput      = z.infer<typeof updateScheduleSchema>
export type ScheduleRowInput         = z.infer<typeof scheduleRowSchema>
