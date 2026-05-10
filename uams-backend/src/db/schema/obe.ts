import {
  pgTable, pgEnum, uuid, varchar, text, boolean,
  numeric, timestamp, jsonb, unique,
} from 'drizzle-orm/pg-core'
import { tenants }                 from './tenants'
import { users }                   from './users'
import { courses, programs, auditActionEnum } from './academic'

export const bloomsLevelEnum = pgEnum('blooms_level', [
  'remember', 'understand', 'apply', 'analyze', 'evaluate', 'create',
])

// ── Course Learning Outcomes ──────────────────────────────────────────────────

export const courseLearningOutcomes = pgTable('course_learning_outcomes', {
  id:           uuid('id').primaryKey().defaultRandom(),
  tenantId:     uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  courseId:     uuid('course_id').notNull().references(() => courses.id, { onDelete: 'restrict' }),
  code:         varchar('code', { length: 20 }).notNull(),   // CLO1, CLO2 …
  description:  text('description').notNull(),
  bloomsLevel:  bloomsLevelEnum('blooms_level'),
  createdBy:    uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy:    uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  deletedBy:    uuid('deleted_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
  updatedAt:    timestamp('updated_at').notNull().defaultNow(),
  deletedAt:    timestamp('deleted_at'),
}, (t) => [
  unique('uq_clo_tenant_course_code').on(t.tenantId, t.courseId, t.code),
])

export const cloAuditLogs = pgTable('clo_audit_logs', {
  id:          uuid('id').primaryKey().defaultRandom(),
  tenantId:    uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  cloId:       uuid('clo_id').notNull(),
  action:      auditActionEnum('action').notNull(),
  performedBy: uuid('performed_by').references(() => users.id, { onDelete: 'set null' }),
  snapshot:    jsonb('snapshot'),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
})

// ── Program Learning Outcomes ─────────────────────────────────────────────────

export const programLearningOutcomes = pgTable('program_learning_outcomes', {
  id:          uuid('id').primaryKey().defaultRandom(),
  tenantId:    uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  programId:   uuid('program_id').notNull().references(() => programs.id, { onDelete: 'restrict' }),
  code:        varchar('code', { length: 20 }).notNull(),   // PLO1, PLO2 …
  description: text('description').notNull(),
  createdBy:   uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy:   uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  deletedBy:   uuid('deleted_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
  updatedAt:   timestamp('updated_at').notNull().defaultNow(),
  deletedAt:   timestamp('deleted_at'),
}, (t) => [
  unique('uq_plo_tenant_program_code').on(t.tenantId, t.programId, t.code),
])

export const ploAuditLogs = pgTable('plo_audit_logs', {
  id:          uuid('id').primaryKey().defaultRandom(),
  tenantId:    uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  ploId:       uuid('plo_id').notNull(),
  action:      auditActionEnum('action').notNull(),
  performedBy: uuid('performed_by').references(() => users.id, { onDelete: 'set null' }),
  snapshot:    jsonb('snapshot'),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
})

// ── CLO–PLO Mappings ──────────────────────────────────────────────────────────

export const cloPloMappings = pgTable('clo_plo_mappings', {
  id:          uuid('id').primaryKey().defaultRandom(),
  tenantId:    uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  cloId:       uuid('clo_id').notNull().references(() => courseLearningOutcomes.id, { onDelete: 'cascade' }),
  ploId:       uuid('plo_id').notNull().references(() => programLearningOutcomes.id, { onDelete: 'cascade' }),
  weight:      numeric('weight', { precision: 3, scale: 2 }).notNull(),  // 0.00 – 1.00
  createdBy:   uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy:   uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
  updatedAt:   timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  unique('uq_clo_plo_mapping').on(t.cloId, t.ploId),
])

export const cloPloMappingAuditLogs = pgTable('clo_plo_mapping_audit_logs', {
  id:          uuid('id').primaryKey().defaultRandom(),
  tenantId:    uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  mappingId:   uuid('mapping_id').notNull(),
  action:      auditActionEnum('action').notNull(),
  performedBy: uuid('performed_by').references(() => users.id, { onDelete: 'set null' }),
  snapshot:    jsonb('snapshot'),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
})

// ── Types ─────────────────────────────────────────────────────────────────────

export type CourseLearningOutcome  = typeof courseLearningOutcomes.$inferSelect
export type ProgramLearningOutcome = typeof programLearningOutcomes.$inferSelect
export type CloPloMapping          = typeof cloPloMappings.$inferSelect
