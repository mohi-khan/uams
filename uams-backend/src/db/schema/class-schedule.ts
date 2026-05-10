import {
  pgTable, pgEnum, uuid, varchar, text, boolean,
  date, timestamp, jsonb,
} from 'drizzle-orm/pg-core'
import { tenants }         from './tenants'
import { users }           from './users'
import { courses, teachers, auditActionEnum } from './academic'
import { batches }         from './enrollment'
import { courseOfferings } from './scheduling'
import { syllabusTopics }  from './syllabus'
import { timeSlots, rooms } from './timetable'

export const classScheduleStatusEnum = pgEnum('class_schedule_status', [
  'SCHEDULED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED',
])

export const dayOfWeekEnum = pgEnum('day_of_week', [
  'SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT',
])

// ── Class Schedules ───────────────────────────────────────────────────────────

export const classSchedules = pgTable('class_schedules', {
  id:               uuid('id').primaryKey().defaultRandom(),
  tenantId:         uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Context
  courseOfferingId: uuid('course_offering_id').notNull().references(() => courseOfferings.id, { onDelete: 'restrict' }),
  courseId:         uuid('course_id').notNull().references(() => courses.id, { onDelete: 'restrict' }),
  teacherId:        uuid('teacher_id').references(() => teachers.id, { onDelete: 'set null' }),
  batchId:          uuid('batch_id').references(() => batches.id, { onDelete: 'set null' }),
  section:          varchar('section', { length: 20 }),

  // Schedule
  sessionDate:      date('session_date').notNull(),
  dayOfWeek:        dayOfWeekEnum('day_of_week').notNull(),
  timeSlotId:       uuid('time_slot_id').notNull().references(() => timeSlots.id, { onDelete: 'restrict' }),

  // Academic linkage
  topicId:          uuid('topic_id'),                         // free-form, for future topics table
  syllabusTopicId:  uuid('syllabus_topic_id').references(() => syllabusTopics.id, { onDelete: 'set null' }),

  // Status
  status:           classScheduleStatusEnum('status').notNull().default('SCHEDULED'),

  // Control
  roomId:           uuid('room_id').references(() => rooms.id, { onDelete: 'set null' }),
  isMakeupClass:    boolean('is_makeup_class').notNull().default(false),
  notes:            text('notes'),

  // Audit
  createdBy:        uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy:        uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  deletedBy:        uuid('deleted_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt:        timestamp('created_at').notNull().defaultNow(),
  updatedAt:        timestamp('updated_at').notNull().defaultNow(),
  deletedAt:        timestamp('deleted_at'),
})

// ── Audit Logs ────────────────────────────────────────────────────────────────

export const classScheduleAuditLogs = pgTable('class_schedule_audit_logs', {
  id:          uuid('id').primaryKey().defaultRandom(),
  tenantId:    uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  scheduleId:  uuid('schedule_id').notNull(),
  action:      auditActionEnum('action').notNull(),
  performedBy: uuid('performed_by').references(() => users.id, { onDelete: 'set null' }),
  snapshot:    jsonb('snapshot'),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
})

export type ClassSchedule         = typeof classSchedules.$inferSelect
export type ClassScheduleAuditLog = typeof classScheduleAuditLogs.$inferSelect
