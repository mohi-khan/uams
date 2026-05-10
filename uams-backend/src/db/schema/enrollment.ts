import { pgTable, uuid, varchar, text, boolean, timestamp, jsonb, integer, unique } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'
import { users } from './users'
import { programs } from './academic'
import { academicSessions } from './academic'
import { auditActionEnum } from './academic'

// ── Student ───────────────────────────────────────────────────────────────────

export const students = pgTable('students', {
  id:             uuid('id').primaryKey().defaultRandom(),
  tenantId:       uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  studentCode:    varchar('student_code', { length: 50 }).notNull(),
  name:           varchar('name', { length: 255 }).notNull(),
  email:          varchar('email', { length: 255 }).notNull(),
  phone:          varchar('phone', { length: 30 }),
  address:        text('address'),
  emergencyPhone: varchar('emergency_phone', { length: 30 }),
  nidBirthReg:    varchar('nid_birth_reg', { length: 100 }),
  photoUrl:       varchar('photo_url', { length: 500 }),
  gmailAccount:   varchar('gmail_account', { length: 255 }),
  isActive:       boolean('is_active').notNull().default(true),
  createdBy:      uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy:      uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  deletedBy:      uuid('deleted_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt:      timestamp('created_at').notNull().defaultNow(),
  updatedAt:      timestamp('updated_at').notNull().defaultNow(),
  deletedAt:      timestamp('deleted_at'),
}, (table) => [
  unique('uq_students_tenant_code').on(table.tenantId,  table.studentCode),
  unique('uq_students_tenant_email').on(table.tenantId, table.email),
  unique('uq_students_tenant_gmail').on(table.tenantId, table.gmailAccount),
])

export const studentAuditLogs = pgTable('student_audit_logs', {
  id:          uuid('id').primaryKey().defaultRandom(),
  tenantId:    uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  studentId:   uuid('student_id').notNull(),
  action:      auditActionEnum('action').notNull(),
  performedBy: uuid('performed_by').references(() => users.id, { onDelete: 'set null' }),
  snapshot:    jsonb('snapshot'),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
})

// ── Batch ─────────────────────────────────────────────────────────────────────

export const batches = pgTable('batches', {
  id:        uuid('id').primaryKey().defaultRandom(),
  tenantId:  uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  programId: uuid('program_id').notNull().references(() => programs.id, { onDelete: 'restrict' }),
  sessionId: uuid('session_id').references(() => academicSessions.id, { onDelete: 'set null' }),
  code:      varchar('code', { length: 50 }).notNull(),
  name:      varchar('name', { length: 255 }).notNull(),
  capacity:  integer('capacity'),
  isActive:  boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  deletedBy: uuid('deleted_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
}, (table) => [
  unique('uq_batches_tenant_code').on(table.tenantId, table.code),
])

export const batchAuditLogs = pgTable('batch_audit_logs', {
  id:          uuid('id').primaryKey().defaultRandom(),
  tenantId:    uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  batchId:     uuid('batch_id').notNull(),
  action:      auditActionEnum('action').notNull(),
  performedBy: uuid('performed_by').references(() => users.id, { onDelete: 'set null' }),
  snapshot:    jsonb('snapshot'),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
})

// ── NID Reveal Log ────────────────────────────────────────────────────────────
// Tracks every time a privileged user reveals a student's masked NID/Birth Reg.

export const studentNidRevealLogs = pgTable('student_nid_reveal_logs', {
  id:          uuid('id').primaryKey().defaultRandom(),
  tenantId:    uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  studentId:   uuid('student_id').notNull(),
  performedBy: uuid('performed_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
})

export type Student             = typeof students.$inferSelect
export type NewStudent          = typeof students.$inferInsert
export type Batch               = typeof batches.$inferSelect
export type NewBatch            = typeof batches.$inferInsert
export type StudentAuditLog     = typeof studentAuditLogs.$inferSelect
export type BatchAuditLog       = typeof batchAuditLogs.$inferSelect
export type StudentNidRevealLog = typeof studentNidRevealLogs.$inferSelect
