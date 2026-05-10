import {
  pgTable, pgEnum, uuid, varchar, text, boolean,
  integer, numeric, timestamp, jsonb, unique,
} from 'drizzle-orm/pg-core'
import { tenants }                          from './tenants'
import { users }                             from './users'
import { courses, auditActionEnum }          from './academic'

export const syllabusStatusEnum = pgEnum('syllabus_status', ['draft', 'final'])

// ── Course Syllabus ───────────────────────────────────────────────────────────

export const courseSyllabi = pgTable('course_syllabi', {
  id:        uuid('id').primaryKey().defaultRandom(),
  tenantId:  uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade'  }),
  courseId:  uuid('course_id').notNull().references(() => courses.id, { onDelete: 'restrict' }),
  version:   varchar('version', { length: 10 }).notNull(),  // 'v1', 'v2', …
  isDefault: boolean('is_default').notNull().default(false),
  status:    syllabusStatusEnum('status').notNull().default('draft'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  deletedBy: uuid('deleted_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
}, (table) => [
  unique('uq_syllabus_tenant_course_version').on(table.tenantId, table.courseId, table.version),
])

export const syllabusAuditLogs = pgTable('syllabus_audit_logs', {
  id:          uuid('id').primaryKey().defaultRandom(),
  tenantId:    uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  syllabusId:  uuid('syllabus_id').notNull(),
  action:      auditActionEnum('action').notNull(),
  performedBy: uuid('performed_by').references(() => users.id, { onDelete: 'set null' }),
  snapshot:    jsonb('snapshot'),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
})

// ── Syllabus Topics ───────────────────────────────────────────────────────────

export const syllabusTopics = pgTable('syllabus_topics', {
  id:             uuid('id').primaryKey().defaultRandom(),
  tenantId:       uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  syllabusId:     uuid('syllabus_id').notNull().references(() => courseSyllabi.id, { onDelete: 'cascade' }),
  title:          varchar('title', { length: 255 }).notNull(),
  description:    text('description'),
  status:         syllabusStatusEnum('status').notNull().default('draft'),
  orderNo:        integer('order_no').notNull().default(0),
  estimatedHours: numeric('estimated_hours', { precision: 5, scale: 1 }),
  createdBy:      uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy:      uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt:      timestamp('created_at').notNull().defaultNow(),
  updatedAt:      timestamp('updated_at').notNull().defaultNow(),
})

// ── Types ─────────────────────────────────────────────────────────────────────

export type CourseSyllabus   = typeof courseSyllabi.$inferSelect
export type SyllabusTopic    = typeof syllabusTopics.$inferSelect
export type SyllabusAuditLog = typeof syllabusAuditLogs.$inferSelect
