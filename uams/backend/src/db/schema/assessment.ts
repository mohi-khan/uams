import {
  pgTable, pgEnum, uuid, varchar, boolean,
  integer, numeric, timestamp, jsonb, unique,
} from 'drizzle-orm/pg-core'
import { tenants }                                   from './tenants'
import { users }                                     from './users'
import { courses, academicSessions, auditActionEnum } from './academic'
import { courseLearningOutcomes }                    from './obe'

export const assessmentComponentTypeEnum = pgEnum('assessment_component_type', [
  'quiz', 'assignment', 'midterm', 'final', 'lab', 'project', 'presentation', 'other',
])

export const assessmentPlanStatusEnum = pgEnum('assessment_plan_status', ['draft', 'final'])

// ── Assessment Plans (versioned parent) ───────────────────────────────────────

export const courseAssessmentPlans = pgTable('course_assessment_plans', {
  id:                uuid('id').primaryKey().defaultRandom(),
  tenantId:          uuid('tenant_id').notNull().references(() => tenants.id,          { onDelete: 'cascade'  }),
  courseId:          uuid('course_id').notNull().references(() => courses.id,          { onDelete: 'restrict' }),
  academicSessionId: uuid('academic_session_id').notNull().references(() => academicSessions.id, { onDelete: 'restrict' }),
  version:           varchar('version', { length: 10 }).notNull(),   // 'v1', 'v2', …
  status:            assessmentPlanStatusEnum('status').notNull().default('draft'),
  isDefault:         boolean('is_default').notNull().default(false),
  createdBy:         uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy:         uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  deletedBy:         uuid('deleted_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt:         timestamp('created_at').notNull().defaultNow(),
  updatedAt:         timestamp('updated_at').notNull().defaultNow(),
  deletedAt:         timestamp('deleted_at'),
}, (t) => [
  unique('uq_assessment_plan_version').on(t.tenantId, t.courseId, t.academicSessionId, t.version),
])

// ── Assessment Plan Audit Logs ────────────────────────────────────────────────

export const assessmentPlanAuditLogs = pgTable('assessment_plan_audit_logs', {
  id:          uuid('id').primaryKey().defaultRandom(),
  tenantId:    uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  planId:      uuid('plan_id').notNull(),
  action:      auditActionEnum('action').notNull(),
  performedBy: uuid('performed_by').references(() => users.id, { onDelete: 'set null' }),
  snapshot:    jsonb('snapshot'),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
})

// ── Assessment Components ─────────────────────────────────────────────────────

export const courseAssessmentComponents = pgTable('course_assessment_components', {
  id:               uuid('id').primaryKey().defaultRandom(),
  tenantId:         uuid('tenant_id').notNull().references(() => tenants.id,              { onDelete: 'cascade'  }),
  planId:           uuid('plan_id').notNull().references(() => courseAssessmentPlans.id,  { onDelete: 'cascade'  }),
  name:             varchar('name', { length: 100 }).notNull(),
  componentType:    assessmentComponentTypeEnum('component_type').notNull(),
  weightPercentage: numeric('weight_percentage', { precision: 5, scale: 2 }).notNull(),
  totalMarks:       integer('total_marks').notNull().default(100),
  assessmentCount:  integer('assessment_count').notNull().default(1),
  cloMapped:        boolean('clo_mapped').notNull().default(false),
  orderNo:          integer('order_no').notNull().default(0),
  createdBy:        uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy:        uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  deletedBy:        uuid('deleted_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt:        timestamp('created_at').notNull().defaultNow(),
  updatedAt:        timestamp('updated_at').notNull().defaultNow(),
  deletedAt:        timestamp('deleted_at'),
})

// ── Assessment Component CLO Links ────────────────────────────────────────────

export const assessmentComponentClos = pgTable('assessment_component_clos', {
  id:          uuid('id').primaryKey().defaultRandom(),
  tenantId:    uuid('tenant_id').notNull().references(() => tenants.id,                 { onDelete: 'cascade'  }),
  componentId: uuid('component_id').notNull().references(() => courseAssessmentComponents.id, { onDelete: 'cascade'  }),
  cloId:       uuid('clo_id').notNull().references(() => courseLearningOutcomes.id,    { onDelete: 'restrict' }),
  weight:      numeric('weight', { precision: 5, scale: 2 }).notNull().default('100'),  // % within component
  createdAt:   timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  unique('uq_assessment_component_clo').on(t.componentId, t.cloId),
])

// ── Types ─────────────────────────────────────────────────────────────────────

export type CourseAssessmentPlan      = typeof courseAssessmentPlans.$inferSelect
export type CourseAssessmentComponent = typeof courseAssessmentComponents.$inferSelect
export type AssessmentComponentClo    = typeof assessmentComponentClos.$inferSelect
