import { pgTable, pgEnum, uuid, integer, timestamp, date, jsonb, unique } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'
import { users } from './users'
import { programs, courses, academicSessions, auditActionEnum, teachers } from './academic'
import { batches } from './enrollment'

export const semesterOfferingStatusEnum = pgEnum('semester_offering_status', [
  'planned',
  'active',
  'completed',
])

// ── Semester Offering ─────────────────────────────────────────────────────────
// Links a program + session + semester number — defines which semester is being run.

export const semesterOfferings = pgTable('semester_offerings', {
  id:          uuid('id').primaryKey().defaultRandom(),
  tenantId:    uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  programId:   uuid('program_id').notNull().references(() => programs.id, { onDelete: 'restrict' }),
  sessionId:   uuid('session_id').notNull().references(() => academicSessions.id, { onDelete: 'restrict' }),
  semesterNo:  integer('semester_no').notNull(),
  status:      semesterOfferingStatusEnum('status').notNull().default('planned'),
  startDate:   date('start_date'),
  endDate:     date('end_date'),
  createdBy:   uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy:   uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  deletedBy:   uuid('deleted_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
  updatedAt:   timestamp('updated_at').notNull().defaultNow(),
  deletedAt:   timestamp('deleted_at'),
}, (table) => [
  unique('uq_sem_off_tenant_prog_session_semno').on(table.tenantId, table.programId, table.sessionId, table.semesterNo),
])

export const semesterOfferingAuditLogs = pgTable('semester_offering_audit_logs', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  tenantId:           uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  semesterOfferingId: uuid('semester_offering_id').notNull(),
  action:             auditActionEnum('action').notNull(),
  performedBy:        uuid('performed_by').references(() => users.id, { onDelete: 'set null' }),
  snapshot:           jsonb('snapshot'),
  createdAt:          timestamp('created_at').notNull().defaultNow(),
})

// ── Course Offering ───────────────────────────────────────────────────────────
// A specific course section within a semester offering.

export const courseOfferings = pgTable('course_offerings', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  tenantId:           uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  semesterOfferingId: uuid('semester_offering_id').notNull().references(() => semesterOfferings.id, { onDelete: 'restrict' }),
  courseId:           uuid('course_id').notNull().references(() => courses.id, { onDelete: 'restrict' }),
  batchId:            uuid('batch_id').references(() => batches.id, { onDelete: 'set null' }),
  capacity:           integer('capacity'),
  teacherId:          uuid('teacher_id').references(() => teachers.id, { onDelete: 'set null' }),
  scheduleInfo:       jsonb('schedule_info'),
  createdBy:          uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy:          uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  deletedBy:          uuid('deleted_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt:          timestamp('created_at').notNull().defaultNow(),
  updatedAt:          timestamp('updated_at').notNull().defaultNow(),
  deletedAt:          timestamp('deleted_at'),
}, (table) => [
  unique('uq_course_off_sem_course_batch').on(table.tenantId, table.semesterOfferingId, table.courseId, table.batchId),
])

export const courseOfferingAuditLogs = pgTable('course_offering_audit_logs', {
  id:               uuid('id').primaryKey().defaultRandom(),
  tenantId:         uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  courseOfferingId: uuid('course_offering_id').notNull(),
  action:           auditActionEnum('action').notNull(),
  performedBy:      uuid('performed_by').references(() => users.id, { onDelete: 'set null' }),
  snapshot:         jsonb('snapshot'),
  createdAt:        timestamp('created_at').notNull().defaultNow(),
})

export type SemesterOffering    = typeof semesterOfferings.$inferSelect
export type CourseOffering      = typeof courseOfferings.$inferSelect
